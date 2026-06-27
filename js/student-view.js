if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

const searchSection = document.getElementById('search-section');
const detailSection = document.getElementById('student-detail');
const searchResults = document.getElementById('search-results');

// Track if opened from staff students page
const cameFromStaff = document.referrer.includes('students.html') ||
                      new URL(window.location.href).searchParams.get('from') === 'staff';

// ─── Page switching ───────────────────────────────────────────────────────────
function showSearchPage() {
  detailSection.style.display = 'none';
  searchSection.style.display = 'block';
}

function showStudentDetailPage() {
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

// ─── Tab switching ────────────────────────────────────────────────────────────
let searchFiltersLoaded = false;

function switchTab(tab) {
  document.querySelectorAll('.sv-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sv-tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`tab-btn-${tab}`).classList.add('active');
  document.getElementById(`tab-panel-${tab}`).style.display = 'block';

  // Load search filters only once, when search tab is first opened
  if (tab === 'search' && !searchFiltersLoaded) {
    searchFiltersLoaded = true;
    loadCourseFilter();
    loadBatchFilter();
  }
}

// ─── All students list ────────────────────────────────────────────────────────
let allStudentsCache = [];

async function loadAllStudentsList() {
  const listWrap = document.getElementById('all-students-list');
  if (!listWrap) return;

  listWrap.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading students...</p></div>';

  const { data, error } = await supabase
    .from('students')
    .select('id, name, roll_no, course, batches(label)')
    .order('name');

  if (error || !data) {
    listWrap.innerHTML = '<div class="error-msg">Failed to load students.</div>';
    return;
  }

  // Filter out TC students from public view
  allStudentsCache = data.filter(s => !s.took_tc);
  renderAllStudentsList('');
}

function renderAllStudentsList(query) {
  const listWrap = document.getElementById('all-students-list');
  if (!listWrap) return;

  const filtered = query
    ? allStudentsCache.filter(s =>
        s.name.toLowerCase().includes(query) ||
        (s.roll_no || '').toLowerCase().includes(query)
      )
    : allStudentsCache;

  if (!filtered.length) {
    listWrap.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted);">No students found.</div>';
    return;
  }

  listWrap.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden;">
      ${filtered.map(s => `
        <div class="student-list-item" onclick="loadStudentDetail('${s.id}')">
          <div class="student-list-main">
            <strong>${s.name}</strong>
            <span class="text-muted" style="margin-left:8px;font-size:0.82rem;">${s.roll_no}</span>
          </div>
          <div class="student-list-meta">
            ${s.course    ? `<span class="badge badge-muted">${s.course}</span>`       : ''}
            ${s.batches?.label ? `<span class="badge badge-info">${s.batches.label}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Scholarship link ─────────────────────────────────────────────────────────
async function loadScholarshipLink() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'scholarship_url')
    .single();

  if (!data?.value) return;

  ['scholarship-link', 'scholarship-link-detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = data.value;
  });
  ['scholarship-wrap', 'scholarship-wrap-detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });
}

// ─── Course & batch filters (search tab) ─────────────────────────────────────
async function loadCourseFilter() {
  const courseFilter = document.getElementById('course-filter');
  if (!courseFilter) return;

  const { data } = await supabase.from('students').select('course');
  if (!data) return;

  courseFilter.innerHTML = '<option value="">All Courses</option>';
  [...new Set(data.map(s => s.course).filter(Boolean))].forEach(course => {
    const opt = document.createElement('option');
    opt.value = course;
    opt.textContent = course;
    courseFilter.appendChild(opt);
  });
}

async function loadBatchFilter() {
  const batchFilter = document.getElementById('batch-filter');
  if (!batchFilter) return;

  const { data } = await supabase.from('batches').select('*').order('year_start');
  if (!data) return;

  batchFilter.innerHTML = '<option value="">All Batches</option>';
  data.forEach(batch => {
    const opt = document.createElement('option');
    opt.value = batch.id;
    opt.textContent = batch.label;
    batchFilter.appendChild(opt);
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function searchStudents() {
  const searchInput  = document.getElementById('search-input');
  const courseFilter = document.getElementById('course-filter');
  const batchFilter  = document.getElementById('batch-filter');

  const query   = searchInput?.value.trim() || '';
  const course  = courseFilter?.value || '';
  const batchId = batchFilter?.value || '';

  if (!query && !course && !batchId) {
    showToast('Please search or select course/batch.', 'danger');
    return;
  }

  searchResults.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

  let request = supabase
    .from('students')
    .select('*, batches(label)')
    .limit(50);

  if (query)   request = request.or(`name.ilike.%${query}%,roll_no.ilike.%${query}%`);
  if (course)  request = request.eq('course', course);
  if (batchId) request = request.eq('batch_id', batchId);

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
    <div class="card" style="padding:0;overflow:hidden;">
      <div style="padding:14px 16px;font-weight:600;border-bottom:1px solid var(--border);">
        ${data.length} students found
      </div>
      ${data.map(s => `
        <div class="student-list-item" onclick="loadStudentDetail('${s.id}')">
          <div class="student-list-main">
            <strong>${s.name}</strong>
            <span class="text-muted" style="margin-left:8px;font-size:0.82rem;">${s.roll_no}</span>
          </div>
          <div class="student-list-meta">
            ${s.course ? `<span class="badge badge-muted">${s.course}</span>` : ''}
            <span class="badge badge-info">${s.batches?.label || ''}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Student detail ───────────────────────────────────────────────────────────
async function loadStudentDetail(studentId, updateUrl = true) {
  if (!studentId) { showSearchPage(); return; }

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

  setText('detail-name',       student.name);
  setText('detail-roll',       `Hall Ticket No: ${student.roll_no}`);
  setText('detail-batch',      `Batch: ${student.batches?.label || '-'} | Course: ${student.course || '-'}`);
  setHtml('detail-phone',      student.phone ? `Phone: ${student.phone}` : '');
  setText('break-college',     formatCurrency(student.college_fee));
  setText('break-attendance',  formatCurrency(student.attendance_fee));
  setText('break-development', formatCurrency(student.development_fee));
  setText('break-total',       formatCurrency(student.total_fee));
  setText('break-concession',  `- ${formatCurrency(student.concession)}`);
  setText('break-scholarship', `- ${formatCurrency(student.scholarship_amount)}`);
  setText('break-net',         formatCurrency(student.net_payable));

  const { totalPaid, balance, percent } = calcFeeSummary(student, payments || []);
  setText('detail-total-fee', formatCurrency(student.total_fee));
  setText('detail-paid',      formatCurrency(totalPaid));
  setText('detail-balance',   formatCurrency(balance));
  setText('detail-percent',   `${percent}% paid`);
  setText('progress-label',   `${percent}%`);

  const bar = document.getElementById('progress-bar');
  bar.style.width = `${percent}%`;
  bar.className   = 'progress-bar';
  if (percent < 40)      bar.classList.add('danger');
  else if (percent < 75) bar.classList.add('warning');

  const tbody = document.getElementById('payment-history');
  if (paymentsError) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Unable to load payments</td></tr>';
  } else if (!payments?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No payments recorded yet</td></tr>';
  } else {
    tbody.innerHTML = payments.map((p, i) => `
      <tr>
        <td>${payments.length - i}</td>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.receipt_no || '-'}</td>
        <td><strong>${formatCurrency(p.amount)}</strong></td>
        <td><span class="badge ${p.mode === 'cash' ? 'badge-warning' : 'badge-success'}">${p.mode}</span></td>
        <td><small>${p.notes || '-'}</small></td>
      </tr>
    `).join('');
  }

  const documents = [
    { label: 'SSC',    value: student.ssc    },
    { label: 'Inter',  value: student.inter   },
    { label: 'Degree', value: student.degree  },
    { label: 'Memos',  value: student.memos   },
    { label: 'TC',     value: student.tc      },
  ];

  setHtml('documents-list', documents.map(doc => {
    const submitted = String(doc.value || '').toLowerCase() === 'yes';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
        <strong>${doc.label}</strong>
        <div>${submitted
          ? '<span class="badge badge-success">Submitted</span>'
          : '<span class="badge badge-danger">Not Submitted</span>'
        }</div>
      </div>
    `;
  }).join(''));
}

// ─── Back button ──────────────────────────────────────────────────────────────
function goBack() {
  if (cameFromStaff) {
    window.location.href = 'students.html';
  } else {
    showSearchPage();
    searchResults.innerHTML = '';
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url);
  }
}

// ─── Event listeners (attached after DOM ready) ───────────────────────────────
document.getElementById('back-btn').addEventListener('click', goBack);

document.getElementById('search-btn').addEventListener('click', searchStudents);

document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchStudents();
});

document.getElementById('list-search-input').addEventListener('input', e => {
  renderAllStudentsList(e.target.value.toLowerCase().trim());
});

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initStudentView() {
  const directId = new URL(window.location.href).searchParams.get('id');

  loadScholarshipLink().catch(() => {});

  if (directId) {
    await loadStudentDetail(directId, false);
    return;
  }

  showSearchPage();
  switchTab('list');
  await loadAllStudentsList();
}

window.loadStudentDetail = loadStudentDetail;
window.switchTab = switchTab;

initStudentView().catch(err => {
  console.error('Student view failed:', err);
  showSearchPage();
  showToast('Page failed to load. Please refresh.', 'danger');
});
