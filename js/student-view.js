if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

const searchSection = document.getElementById('search-section');
const detailSection = document.getElementById('student-detail');
const searchInput = document.getElementById('search-input');
const courseFilter = document.getElementById('course-filter');
const batchFilter = document.getElementById('batch-filter');
const searchResults = document.getElementById('search-results');

if (!searchSection || !detailSection) {
  console.error('Required DOM elements not found. Check student-view.html structure.');
}

function showSearchPage() {
  detailSection.style.display = 'none';
  searchSection.style.display = 'block';
}


  function showStudentDetailPage() {
  console.log('showStudentDetailPage called', searchSection, detailSection);
  searchSection.style.display = 'none';
  detailSection.style.display = 'block';
}


function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

async function loadScholarshipLink() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'scholarship_url')
    .single();

  if (!data?.value) return;

  const link1 = document.getElementById('scholarship-link');
  const wrap1 = document.getElementById('scholarship-wrap');
  const link2 = document.getElementById('scholarship-link-detail');
  const wrap2 = document.getElementById('scholarship-wrap-detail');

  if (link1) link1.href = data.value;
  if (wrap1) wrap1.style.display = 'block';
  if (link2) link2.href = data.value;
  if (wrap2) wrap2.style.display = 'block';
}

async function loadCourseFilter() {
  const { data } = await supabase
    .from('students')
    .select('course');

  if (!courseFilter || !data) return;

  courseFilter.innerHTML = '<option value="">All Courses</option>';

  const courses = [...new Set(data.map((s) => s.course).filter(Boolean))];

  courses.forEach((course) => {
    const opt = document.createElement('option');
    opt.value = course;
    opt.textContent = course;
    courseFilter.appendChild(opt);
  });
}

async function loadBatchFilter() {
  const { data } = await supabase
    .from('batches')
    .select('*')
    .order('year_start');

  if (!batchFilter || !data) return;

  batchFilter.innerHTML = '<option value="">All Batches</option>';

  data.forEach((batch) => {
    const opt = document.createElement('option');
    opt.value = batch.id;
    opt.textContent = batch.label;
    batchFilter.appendChild(opt);
  });
}

async function loadSearchFilters() {
  await Promise.all([loadCourseFilter(), loadBatchFilter()]);
}

async function searchStudents() {
  const query = searchInput.value.trim();
  const course = courseFilter.value;
  const batchId = batchFilter.value;

  if (!query && !course && !batchId) {
    showToast('Please search or select course/batch.', 'danger');
    return;
  }

  searchResults.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

  let request = supabase
    .from('students')
    .select('*, batches(label)')
    .limit(50);

  if (query) {
    request = request.or(`name.ilike.%${query}%,roll_no.ilike.%${query}%`);
  }

  if (course) {
    request = request.eq('course', course);
  }

  if (batchId) {
    request = request.eq('batch_id', batchId);
  }

  const { data, error } = await request;

  if (error || !data) {
    searchResults.innerHTML = '<div class="error-msg">Search failed. Please try again.</div>';
    return;
  }

  if (!data.length) {
    searchResults.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted);">No students found.</div>';
    return;
  }

  if (data.length === 1) {
    loadStudentDetail(data[0].id);
    return;
  }

  searchResults.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:12px;">Select student record</div>
      ${data.map((s) => `
        <div
          onclick="loadStudentDetail('${s.id}')"
          style="padding:12px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s;"
          onmouseover="this.style.borderColor='var(--primary)'"
          onmouseout="this.style.borderColor='var(--border)'"
        >
          <strong>${s.name}</strong>
          <span class="text-muted" style="margin-left:8px;">${s.roll_no}</span>
          <span class="badge badge-info" style="margin-left:8px;">${s.batches?.label || ''}</span>
          ${s.course ? `<span class="badge badge-muted" style="margin-left:8px;">${s.course}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

async function loadStudentDetail(studentId, updateUrl = true) {
  if (!studentId) {
    showSearchPage();
    return;
  }

  showStudentDetailPage();

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('id', studentId);
    window.history.pushState({}, '', url);
  }

  const { data: student, error } = await supabase
    .from('students')
    .select('*, batches(label)')
    .eq('id', studentId)
    .single();

  if (error || !student) {
    showToast('Student not found.', 'danger');
    showSearchPage();
    return;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false });

  setText('detail-name', student.name);
  setText('detail-roll', `Hall Ticket No: ${student.roll_no}`);
  setText('detail-batch', `Batch: ${student.batches?.label || '-'} | Course: ${student.course || '-'}`);
  setHtml('detail-phone', student.phone ? `Phone: ${student.phone}` : '');

  setText('break-college', formatCurrency(student.college_fee));
  setText('break-attendance', formatCurrency(student.attendance_fee));
  setText('break-development', formatCurrency(student.development_fee));
  setText('break-total', formatCurrency(student.total_fee));
  setText('break-concession', `- ${formatCurrency(student.concession)}`);
  setText('break-scholarship', `- ${formatCurrency(student.scholarship_amount)}`);
  setText('break-net', formatCurrency(student.net_payable));

  const { totalPaid, balance, percent } = calcFeeSummary(student, payments || []);

  setText('detail-total-fee', formatCurrency(student.total_fee));
  setText('detail-paid', formatCurrency(totalPaid));
  setText('detail-balance', formatCurrency(balance));
  setText('detail-percent', `${percent}% paid`);
  setText('progress-label', `${percent}%`);

  const bar = document.getElementById('progress-bar');
  bar.style.width = `${percent}%`;
  bar.className = 'progress-bar';

  if (percent < 40) {
    bar.classList.add('danger');
  } else if (percent < 75) {
    bar.classList.add('warning');
  }

  const tbody = document.getElementById('payment-history');

  if (paymentsError) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Unable to load payments</td></tr>';
  } else if (!payments || !payments.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No payments recorded yet</td></tr>';
  } else {
    tbody.innerHTML = payments.map((p, i) => `
      <tr>
        <td>${payments.length - i}</td>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.receipt_no || '-'}</td>
        <td><strong>${formatCurrency(p.amount)}</strong></td>
        <td>
          <span class="badge ${p.mode === 'cash' ? 'badge-warning' : 'badge-success'}">
            ${p.mode}
          </span>
        </td>
        <td><small>${p.notes || '-'}</small></td>
      </tr>
    `).join('');
  }

  const documents = [
    { label: 'SSC', value: student.ssc },
    { label: 'Inter', value: student.inter },
    { label: 'Degree', value: student.degree },
    { label: 'Memos', value: student.memos },
    { label: 'TC', value: student.tc },
  ];

  setHtml('documents-list', documents.map((doc) => {
    const submitted = String(doc.value || '').toLowerCase() === 'yes';

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
        <div><strong>${doc.label}</strong></div>
        <div>
          ${
            submitted
              ? '<span class="badge badge-success">Submitted</span>'
              : '<span class="badge badge-danger">Not Submitted</span>'
          }
        </div>
      </div>
    `;
  }).join(''));
}

function goBack() {
  showSearchPage();
  searchResults.innerHTML = '';

  const url = new URL(window.location.href);
  
  url.searchParams.delete('id');
  window.history.pushState({}, '', url);
}

document.getElementById('search-btn').addEventListener('click', searchStudents);

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchStudents();
});

document.getElementById('back-btn').addEventListener('click', goBack);

async function initStudentView() {
  const url = new URL(window.location.href);

  loadScholarshipLink().catch((err) => {
    console.warn('Scholarship link failed to load:', err);
  });

  const directId = url.searchParams.get('id');

  if (directId) {
    await loadStudentDetail(directId, false);
    return;
  }

  showSearchPage();
  await loadSearchFilters();
}

window.loadStudentDetail = loadStudentDetail;

initStudentView().catch((err) => {
  console.error('Student view failed to load:', err);
  showSearchPage();
  showToast('Page failed to load. Please refresh.', 'danger');
});
