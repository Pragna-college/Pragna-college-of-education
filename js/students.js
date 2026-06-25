// Students page logic

let allStudents = [];
let allPayments = [];
let batches = [];
let deleteStudentId = null;

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

  renderStudents();
}

// Render students table
function renderStudents() {
  const search  = document.getElementById('search-input').value.toLowerCase();
  const batchId = document.getElementById('batch-filter').value;
  const status  = document.getElementById('status-filter').value;

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
    return matchSearch && matchBatch && matchStatus;
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
          <a href="student-view.html?id=${s.id}">${s.name}</a>
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
  document.getElementById('search-input').addEventListener('input', debounce(renderStudents));
  document.getElementById('batch-filter').addEventListener('change', renderStudents);
  document.getElementById('status-filter').addEventListener('change', renderStudents);

  // Fee calc preview
  ['college-fee', 'attendance-fee', 'development-fee', 'concession'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCalc);
  });
}

// Init
initStudents();
