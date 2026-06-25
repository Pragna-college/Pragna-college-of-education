// Students page logic

let allStudents = [];
let allPayments = [];
let batches = [];
let deleteStudentId = null;

function openStudentDetails(studentId) {
  window.location.href = `/student-view.html?id=${encodeURIComponent(studentId)}`;
}

async function initStudents() {
  await initAuth();
  await loadBatches();
  await loadStudents();
  setupEventListeners();
}

// Load batches into dropdowns
async function loadBatches() {
  const { data, error } = await supabase.from('batches').select('*').order('year_start');
  if (error || !data) return;
  batches = data;

  const filterSelect = document.getElementById('batch-filter');
  const modalSelect  = document.getElementById('batch-id');

  data.forEach((b) => {
    const opt1 = document.createElement('option');
    opt1.value = b.id;
    opt1.textContent = b.label;
    filterSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = b.id;
    opt2.textContent = b.label;
    modalSelect.appendChild(opt2);
  });
}

// Load all students with payments
async function loadStudents() {
  showLoading('students-table', 'Loading students...');

  const { data: students, error } = await supabase
    .from('students')
    .select('*, batches(label)')
    .order('name');

  if (error) {
    showError('students-table', 'Failed to load students.');
    return;
  }

  const { data: payments } = await supabase
    .from('fee_payments')
    .select('student_id, amount');

  allStudents = students || [];
allPayments = payments || [];

loadCourseFilter();
renderStudents();
}
function loadCourseFilter() {
  const select = document.getElementById('course-filter');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">All Courses</option>';

  const courses = [...new Set(
    allStudents
      .map(s => s.course)
      .filter(Boolean)
  )];

  courses.forEach(course => {
    const opt = document.createElement('option');
    opt.value = course;
    opt.textContent = course;
    select.appendChild(opt);
  });

  select.value = currentValue;
}
// Render students table
function renderStudents() {
  const searchInput = document.getElementById('search-input');
const batchFilter = document.getElementById('batch-filter');
const statusFilter = document.getElementById('status-filter');
const courseFilter = document.getElementById('course-filter');

const search = searchInput ? searchInput.value.toLowerCase() : '';
const batchId = batchFilter ? batchFilter.value : '';
const status = statusFilter ? statusFilter.value : '';
const course = courseFilter ? courseFilter.value : '';
  // Build paid map
  const paidMap = {};
  allPayments.forEach((p) => {
    paidMap[p.student_id] = (paidMap[p.student_id] || 0) + p.amount;
  });

  let filtered = allStudents.filter((s) => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search) ||
      s.roll_no.toLowerCase().includes(search);
    const matchBatch  = !batchId || s.batch_id === batchId;
    const paid        = paidMap[s.id] || 0;
    const balance     = (s.net_payable || 0) - paid;
    const matchStatus = !status ||
  (status === 'due'   && balance > 0) ||
  (status === 'clear' && balance <= 0);

const matchCourse = !course || s.course === course;

return matchSearch && matchBatch && matchStatus && matchCourse;
  });

  const tbody = document.getElementById('students-table');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No students found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((s) => {
    const paid    = paidMap[s.id] || 0;
    const balance = (s.net_payable || 0) - paid;
    const percent = s.net_payable > 0
      ? Math.round((paid / s.net_payable) * 100)
      : 0;
    const barClass = percent >= 75 ? '' : percent >= 40 ? 'warning' : 'danger';

    return `
      <tr>
        <td><strong>${s.roll_no}</strong></td>
        <td>
          <a href="#" onclick="openStudentDetails('${s.id}'); return false;">${s.name}</a>
          ${s.notes ? `<br><small class="text-muted">${s.notes}</small>` : ''}
        </td>
        <td>${s.phone || '—'}</td>
        <td><span class="badge badge-info">${s.batches?.label || '—'}</span></td>
        <td>${formatCurrency(s.net_payable)}</td>
        <td class="text-success"><strong>${formatCurrency(paid)}</strong></td>
        <td class="${balance > 0 ? 'text-danger' : 'text-success'}">
          <strong>${formatCurrency(balance)}</strong>
        </td>
        <td style="min-width:120px;">
          <div class="progress">
            <div class="progress-bar ${barClass}" style="width:${percent}%"></div>
          </div>
          <small class="text-muted">${percent}%</small>
        </td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-outline btn-sm" onclick="openEdit('${s.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="openDelete('${s.id}', '${s.name.replace(/'/g, "\\'")}')">🗑️</button>
            <a href="payments.html?student=${s.id}" class="btn btn-success btn-sm">💰</a>
            ${s.phone ? `<a href="${whatsappLink(s.phone, `Hello ${s.name}, your current fee balance is ${formatCurrency(balance)}.`)}" target="_blank" class="btn btn-warning btn-sm">💬</a>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Open add modal
function openAdd() {
  document.getElementById('modal-title').textContent  = 'Add Student';
  document.getElementById('student-id').value         = '';
  document.getElementById('roll-no').value            = '';
  document.getElementById('student-name').value       = '';
  document.getElementById('student-phone').value      = '';
  document.getElementById('batch-id').value           = '';
  document.getElementById('college-fee').value        = '';
  document.getElementById('attendance-fee').value     = '';
  document.getElementById('development-fee').value    = '';
  document.getElementById('concession').value         = '';
  document.getElementById('scholarship-amount').value = '';
  document.getElementById('student-notes').value      = '';
  updateCalc();
  document.getElementById('student-modal').classList.add('open');
}

// Open edit modal
async function openEdit(id) {
  const student = allStudents.find((s) => s.id === id);
  if (!student) return;

  document.getElementById('modal-title').textContent       = 'Edit Student';
  document.getElementById('student-id').value              = student.id;
  document.getElementById('roll-no').value                 = student.roll_no;
  document.getElementById('student-name').value            = student.name;
  document.getElementById('student-phone').value           = student.phone || '';
  document.getElementById('batch-id').value                = student.batch_id || '';
  document.getElementById('college-fee').value             = student.college_fee || '';
  document.getElementById('attendance-fee').value          = student.attendance_fee || '';
  document.getElementById('development-fee').value         = student.development_fee || '';
  document.getElementById('concession').value              = student.concession || '';
  document.getElementById('scholarship-amount').value      = student.scholarship_amount || '';
  document.getElementById('student-notes').value           = student.notes || '';
  updateCalc();
  document.getElementById('student-modal').classList.add('open');
}

// Close modal
function closeModal() {
  document.getElementById('student-modal').classList.remove('open');
}

// Update fee calculation preview
function updateCalc() {
  const college     = parseFloat(document.getElementById('college-fee').value)     || 0;
  const attendance  = parseFloat(document.getElementById('attendance-fee').value)  || 0;
  const development = parseFloat(document.getElementById('development-fee').value) || 0;
  const concession  = parseFloat(document.getElementById('concession').value)      || 0;

  const total = college + attendance + development;
  const net   = total - concession;

  document.getElementById('calc-total').textContent     = formatCurrency(total);
  document.getElementById('calc-concession').textContent = formatCurrency(concession);
  document.getElementById('calc-net').textContent       = formatCurrency(net);
}

// Save student
async function saveStudent() {
  const id         = document.getElementById('student-id').value;
  const rollNo     = document.getElementById('roll-no').value.trim();
  const name       = document.getElementById('student-name').value.trim();
  const phone      = document.getElementById('student-phone').value.trim();
  const batchId    = document.getElementById('batch-id').value;
  const collegeFee     = parseFloat(document.getElementById('college-fee').value)     || 0;
  const attendanceFee  = parseFloat(document.getElementById('attendance-fee').value)  || 0;
  const developmentFee = parseFloat(document.getElementById('development-fee').value) || 0;
  const concession     = parseFloat(document.getElementById('concession').value)      || 0;
  const scholarship    = parseFloat(document.getElementById('scholarship-amount').value) || 0;
  const notes      = document.getElementById('student-notes').value.trim();

  if (!rollNo || !name || !batchId) {
    showToast('Please fill Roll No, Name and Batch.', 'danger');
    return;
  }

  const payload = {
    roll_no: rollNo,
    name,
    phone: phone || null,
    batch_id: batchId,
    college_fee: collegeFee,
    attendance_fee: attendanceFee,
    development_fee: developmentFee,
    concession,
    scholarship_amount: scholarship,
    notes: notes || null,
  };

  const btn = document.getElementById('save-student-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (id) {
      // Edit
      const old = allStudents.find((s) => s.id === id);
      const { error } = await supabase.from('students').update(payload).eq('id', id);
      if (error) throw error;
      await writeAudit('students', 'UPDATE', old, { ...old, ...payload });
      showToast('Student updated successfully!');
    } else {
      // Add
      const { error } = await supabase.from('students').insert(payload);
      if (error) throw error;
      await writeAudit('students', 'INSERT', null, payload);
      showToast('Student added successfully!');
    }

    closeModal();
    await loadStudents();
  } catch (err) {
    showToast(err.message || 'Failed to save student.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Student';
  }
}

// Open delete confirm
function openDelete(id, name) {
  deleteStudentId = id;
  document.getElementById('delete-student-name').textContent = name;
  document.getElementById('delete-modal').classList.add('open');
}

// Confirm delete
async function confirmDelete() {
  if (!deleteStudentId) return;

  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const old = allStudents.find((s) => s.id === deleteStudentId);
    const { error } = await supabase.from('students').delete().eq('id', deleteStudentId);
    if (error) throw error;
    await writeAudit('students', 'DELETE', old, null);
    showToast('Student deleted.');
    document.getElementById('delete-modal').classList.remove('open');
    deleteStudentId = null;
    await loadStudents();
  } catch (err) {
    showToast(err.message || 'Failed to delete student.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

// Setup all event listeners
function setupEventListeners() {
  document.getElementById('add-student-btn').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('save-student-btn').addEventListener('click', saveStudent);
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);
  document.getElementById('delete-modal-close').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('open');
  });
  document.getElementById('delete-cancel-btn').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('open');
  });

  // Search and filters
  const searchInput = document.getElementById('search-input');
const batchFilter = document.getElementById('batch-filter');
const statusFilter = document.getElementById('status-filter');
const courseFilter = document.getElementById('course-filter');

if (searchInput) {
  searchInput.addEventListener('input', debounce(renderStudents));
}

if (batchFilter) {
  batchFilter.addEventListener('change', renderStudents);
}

if (statusFilter) {
  statusFilter.addEventListener('change', renderStudents);
}

if (courseFilter) {
  courseFilter.addEventListener('change', renderStudents);
}

  // Fee calc preview
  ['college-fee', 'attendance-fee', 'development-fee', 'concession'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCalc);
  });
  // Excel upload
  document.getElementById('upload-excel-btn').addEventListener('click', openExcelModal);
  document.getElementById('excel-modal-close').addEventListener('click', closeExcelModal);
  document.getElementById('excel-cancel-btn').addEventListener('click', closeExcelModal);
  document.getElementById('excel-file').addEventListener('change', handleExcelFile);
  document.getElementById('import-excel-btn').addEventListener('click', importExcelData);
  }

// ================= EXCEL UPLOAD =================

let excelRows = [];

// Open Excel modal
function openExcelModal() {
  excelRows = [];
  document.getElementById('excel-file').value = '';
  document.getElementById('excel-preview').innerHTML = '';
  document.getElementById('import-excel-btn').disabled = true;
  document.getElementById('excel-modal').classList.add('open');
}

// Close Excel modal
function closeExcelModal() {
  document.getElementById('excel-modal').classList.remove('open');
}

// Convert Excel date to YYYY-MM-DD
function parseExcelDate(value) {
  if (!value) return null;

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const yyyy = date.y;
    const mm = String(date.m).padStart(2, '0');
    const dd = String(date.d).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(value);
  if (!isNaN(d)) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// Convert amount safely
function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Read Excel file
// Convert Yes/No values safely
function normalizeYesNo(value) {
  if (!value) return 'No';

  const v = String(value).trim().toLowerCase();

  if (v === 'yes' || v === 'y' || v === 'submitted' || v === '1') {
    return 'Yes';
  }

  if (v === 'no' || v === 'n' || v === 'not submitted' || v === '0') {
    return 'No';
  }

  return String(value).trim();
}

function handleExcelFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    excelRows = rows.map((row, index) => {
      const rollNo = String(row['Hall ticket no'] || '').trim();
      const name = String(row['Name'] || '').trim();

      const collegeFee = toNumber(row['College fee']);
      const devFee = toNumber(row['Dev Fee']);
      const addFee = toNumber(row['Add Fee']);

      const payments = [];

      for (let i = 1; i <= 10; i++) {
        const amount = toNumber(row[`Fee ${i}`]);
        const date = parseExcelDate(row[`Date ${i}`]);

        if (amount > 0) {
          payments.push({
            amount,
            payment_date: date || new Date().toISOString().split('T')[0],
            mode: 'cash',
            receipt_no: null,
            notes: `Imported from Excel - Fee ${i}`,
          });
        }
      }

      return {
        row_no: index + 2,
        roll_no: rollNo,
        name,
        father_name: String(row['Father name'] || '').trim(),
        quota: String(row['Quota'] || '').trim(),
        course: String(row['Course'] || '').trim(),
        ssc: normalizeYesNo(row['SSC']),
        inter: normalizeYesNo(row['Inter']),
        degree: normalizeYesNo(row['Degree']),
        memos: normalizeYesNo(row['Memos']),
        tc: normalizeYesNo(row['TC']),
        college_fee: collegeFee,
        attendance_fee: addFee,
        development_fee: devFee,
        saree_amount: toNumber(row['Saree Amount']),
        id_card: toNumber(row['ID Card']),
        concession: 0,
        scholarship_amount: 0,
        notes: '',
        payments,
        valid: !!rollNo && !!name,
      };
    });

    renderExcelPreview();
  };

  reader.readAsArrayBuffer(file);
}

// Preview Excel rows before import
function renderExcelPreview() {
  const preview = document.getElementById('excel-preview');

  if (!excelRows.length) {
    preview.innerHTML = '<div class="error-msg">No rows found in Excel.</div>';
    document.getElementById('import-excel-btn').disabled = true;
    return;
  }

  const validCount = excelRows.filter(r => r.valid).length;
  const invalidCount = excelRows.length - validCount;

  preview.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card info">
        <div class="label">Total Rows</div>
        <div class="value">${excelRows.length}</div>
      </div>
      <div class="summary-card success">
        <div class="label">Valid Rows</div>
        <div class="value">${validCount}</div>
      </div>
      <div class="summary-card danger">
        <div class="label">Invalid Rows</div>
        <div class="value">${invalidCount}</div>
      </div>
    </div>

    <div class="table-wrap" style="max-height:320px;overflow:auto;">
      <table>
        <thead>
          <tr>
            <th>Row</th>
            <th>Hall Ticket</th>
            <th>Name</th>
            <th>Course</th>
            <th>Total Fee</th>
            <th>Payments</th>
            <th>Docs</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${excelRows.slice(0, 30).map(r => {
            const totalFee = r.college_fee + r.attendance_fee + r.development_fee;
            return `
              <tr>
                <td>${r.row_no}</td>
                <td>${r.roll_no || '—'}</td>
                <td>${r.name || '—'}</td>
                <td>${r.course || '—'}</td>
                <td>${formatCurrency(totalFee)}</td>
                <td>${r.payments.length}</td>
                <td>
                  SSC: ${r.ssc || 'No'}<br>
                  Inter: ${r.inter || 'No'}<br>
                  Degree: ${r.degree || 'No'}<br>
                  Memos: ${r.memos || 'No'}<br>
                  TC: ${r.tc || 'No'}
                </td>
                <td>
                  ${
                    r.valid
                      ? '<span class="badge badge-success">Ready</span>'
                      : '<span class="badge badge-danger">Missing hall ticket/name</span>'
                  }
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    ${excelRows.length > 30 ? `<p class="text-muted mt-1">Showing first 30 rows only.</p>` : ''}
  `;

  document.getElementById('import-excel-btn').disabled = validCount === 0;
}

// Import Excel rows into Supabase
async function importExcelData() {
  const validRows = excelRows.filter(r => r.valid);

  if (!validRows.length) {
    showToast('No valid rows to import.', 'danger');
    return;
  }

  const batchId = batches[0]?.id;

  if (!batchId) {
    showToast('No batch found. Please create batch first.', 'danger');
    return;
  }

  const btn = document.getElementById('import-excel-btn');
  btn.disabled = true;
  btn.textContent = 'Importing...';

  let successCount = 0;
  let paymentCount = 0;
  let failedRows = [];

  try {
    const user = await getCurrentUser();

    for (const row of validRows) {
      const studentPayload = {
        roll_no: row.roll_no,
        name: row.name,
        father_name: row.father_name || null,
        quota: row.quota || null,
        course: row.course || null,
        ssc: row.ssc || null,
        inter: row.inter || null,
        degree: row.degree || null,
        memos: row.memos || null,
        tc: row.tc || null,
        batch_id: batchId,
        college_fee: row.college_fee,
        attendance_fee: row.attendance_fee,
        development_fee: row.development_fee,
        saree_amount: row.saree_amount,
        id_card: row.id_card,
        concession: row.concession,
        scholarship_amount: row.scholarship_amount,
        notes: row.notes || null,
      };

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert(studentPayload)
        .select()
        .single();

      if (studentError) {
        failedRows.push({
          row: row.row_no,
          name: row.name,
          reason: studentError.message,
        });
        continue;
      }

      successCount++;

      await writeAudit('students', 'INSERT', null, {
        ...studentPayload,
        imported_from: 'excel',
      });

      if (row.payments.length > 0) {
        const paymentPayload = row.payments.map(p => ({
          student_id: studentData.id,
          amount: p.amount,
          mode: p.mode,
          payment_date: p.payment_date,
          receipt_no: p.receipt_no,
          notes: p.notes,
          recorded_by: user?.email || 'excel import',
        }));

        const { error: paymentError } = await supabase
          .from('fee_payments')
          .insert(paymentPayload);

        if (!paymentError) {
          paymentCount += paymentPayload.length;

          await writeAudit('fee_payments', 'INSERT', null, {
            student: row.name,
            roll_no: row.roll_no,
            payment_count: paymentPayload.length,
            imported_from: 'excel',
          });
        }
      }
    }

    let message = `${successCount} students imported. ${paymentCount} payments added.`;

    if (failedRows.length > 0) {
      message += ` ${failedRows.length} rows failed.`;
      console.warn('Failed rows:', failedRows);
    }

    showToast(message, failedRows.length ? 'warning' : 'success');

    closeExcelModal();
    await loadStudents();

  } catch (err) {
    showToast(err.message || 'Excel import failed.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import Data';
  }
}
// Init
initStudents();
