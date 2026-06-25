// Certificates page logic

let allCertificates = [];
let allStudents = [];
let deleteCertId = null;

async function initCertificates() {
  await initAuth();
  await loadStudents();
  await loadCertificates();
  setupEventListeners();
}

// Load students into select
async function loadStudents() {
  const { data } = await supabase
    .from('students')
    .select('id, name, roll_no, batch_id, batches(label)')
    .order('name');

  allStudents = data || [];

  const select = document.getElementById('student-select');
  allStudents.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.roll_no} — ${s.name}`;
    select.appendChild(opt);
  });
}

// Load all certificates
async function loadCertificates() {
  showLoading('certificates-table', 'Loading certificates...');

  const { data, error } = await supabase
    .from('certificates')
    .select('*, students(name, roll_no, batch_id, batches(label))')
    .order('created_at', { ascending: false });

  if (error) {
    showError('certificates-table', 'Failed to load certificates.');
    return;
  }

  allCertificates = data || [];
  renderCertificates();
}

// Render certificates table
function renderCertificates() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const type   = document.getElementById('type-filter').value;
  const status = document.getElementById('status-filter').value;

  let filtered = allCertificates.filter((c) => {
    const matchSearch = !search ||
      c.students?.name?.toLowerCase().includes(search) ||
      c.students?.roll_no?.toLowerCase().includes(search);
    const matchType   = !type   || c.type === type;
    const matchStatus = !status ||
      (status === 'issued'  && c.issued_date) ||
      (status === 'pending' && !c.issued_date);
    return matchSearch && matchType && matchStatus;
  });

  // Update summary cards
  const issued  = filtered.filter((c) => c.issued_date).length;
  const pending = filtered.filter((c) => !c.issued_date).length;

  document.getElementById('total-requests').textContent = filtered.length;
  document.getElementById('total-issued').textContent   = issued;
  document.getElementById('total-pending').textContent  = pending;

  const tbody = document.getElementById('certificates-table');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No certificates found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((c) => {
    const isIssued = !!c.issued_date;
    return `
      <tr>
        <td>
          <strong>${c.students?.name || '—'}</strong><br>
          <small class="text-muted">${c.students?.roll_no || ''}</small>
        </td>
        <td><span class="badge badge-info">${c.students?.batches?.label || '—'}</span></td>
        <td><span class="badge badge-muted">${c.type}</span></td>
        <td>${formatDate(c.requested_date)}</td>
        <td>
          <span class="badge ${isIssued ? 'badge-success' : 'badge-danger'}">
            ${isIssued ? 'Issued' : 'Pending'}
          </span>
        </td>
        <td>${formatDate(c.issued_date)}</td>
        <td><small>${c.issued_by || '—'}</small></td>
        <td><small>${c.notes || '—'}</small></td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-outline btn-sm" onclick="openEdit('${c.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="openDelete('${c.id}')">🗑️</button>
            ${!isIssued
              ? `<button class="btn btn-success btn-sm" onclick="markIssued('${c.id}')">✓ Issue</button>`
              : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Open add modal
function openAdd() {
  document.getElementById('modal-title').textContent  = 'Add Certificate';
  document.getElementById('cert-id').value            = '';
  document.getElementById('student-select').value     = '';
  document.getElementById('cert-type').value          = '';
  document.getElementById('requested-date').value     = new Date().toISOString().split('T')[0];
  document.getElementById('issued-date').value        = '';
  document.getElementById('issued-by').value          = '';
  document.getElementById('cert-notes').value         = '';
  document.getElementById('cert-modal').classList.add('open');
}

// Open edit modal
function openEdit(id) {
  const cert = allCertificates.find((c) => c.id === id);
  if (!cert) return;

  document.getElementById('modal-title').textContent  = 'Edit Certificate';
  document.getElementById('cert-id').value            = cert.id;
  document.getElementById('student-select').value     = cert.student_id;
  document.getElementById('cert-type').value          = cert.type;
  document.getElementById('requested-date').value     = cert.requested_date || '';
  document.getElementById('issued-date').value        = cert.issued_date || '';
  document.getElementById('issued-by').value          = cert.issued_by || '';
  document.getElementById('cert-notes').value         = cert.notes || '';
  document.getElementById('cert-modal').classList.add('open');
}

// Close modal
function closeModal() {
  document.getElementById('cert-modal').classList.remove('open');
}

// Quick mark as issued
async function markIssued(id) {
  const today = new Date().toISOString().split('T')[0];
  const user  = await getCurrentUser();

  try {
    const old = allCertificates.find((c) => c.id === id);
    const { error } = await supabase
      .from('certificates')
      .update({
        issued_date: today,
        issued_by: user?.email || 'unknown',
      })
      .eq('id', id);

    if (error) throw error;
    await writeAudit('certificates', 'UPDATE', old, {
      ...old,
      issued_date: today,
      issued_by: user?.email,
    });
    showToast('Certificate marked as issued!');
    await loadCertificates();
  } catch (err) {
    showToast(err.message || 'Failed to update certificate.', 'danger');
  }
}

// Save certificate
async function saveCertificate() {
  const id            = document.getElementById('cert-id').value;
  const studentId     = document.getElementById('student-select').value;
  const type          = document.getElementById('cert-type').value;
  const requestedDate = document.getElementById('requested-date').value;
  const issuedDate    = document.getElementById('issued-date').value;
  const issuedBy      = document.getElementById('issued-by').value.trim();
  const notes         = document.getElementById('cert-notes').value.trim();

  if (!studentId || !type) {
    showToast('Please select Student and Certificate Type.', 'danger');
    return;
  }

  const payload = {
    student_id:     studentId,
    type,
    requested_date: requestedDate || null,
    issued_date:    issuedDate    || null,
    issued_by:      issuedBy      || null,
    notes:          notes         || null,
  };

  const btn = document.getElementById('save-cert-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (id) {
      const old = allCertificates.find((c) => c.id === id);
      const { error } = await supabase.from('certificates').update(payload).eq('id', id);
      if (error) throw error;
      await writeAudit('certificates', 'UPDATE', old, { ...old, ...payload });
      showToast('Certificate updated successfully!');
    } else {
      const { error } = await supabase.from('certificates').insert(payload);
      if (error) throw error;
      await writeAudit('certificates', 'INSERT', null, payload);
      showToast('Certificate added successfully!');
    }

    closeModal();
    await loadCertificates();
  } catch (err) {
    showToast(err.message || 'Failed to save certificate.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Certificate';
  }
}

// Open delete confirm
function openDelete(id) {
  deleteCertId = id;
  document.getElementById('delete-modal').classList.add('open');
}

// Confirm delete
async function confirmDelete() {
  if (!deleteCertId) return;

  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const old = allCertificates.find((c) => c.id === deleteCertId);
    const { error } = await supabase.from('certificates').delete().eq('id', deleteCertId);
    if (error) throw error;
    await writeAudit('certificates', 'DELETE', old, null);
    showToast('Certificate deleted.');
    document.getElementById('delete-modal').classList.remove('open');
    deleteCertId = null;
    await loadCertificates();
  } catch (err) {
    showToast(err.message || 'Failed to delete certificate.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('add-cert-btn').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('save-cert-btn').addEventListener('click', saveCertificate);
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);
  document.getElementById('delete-modal-close').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('open');
  });
  document.getElementById('delete-cancel-btn').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('open');
  });

  // Filters
  document.getElementById('search-input').addEventListener('input', debounce(renderCertificates));
  document.getElementById('type-filter').addEventListener('change', renderCertificates);
  document.getElementById('status-filter').addEventListener('change', renderCertificates);
}

// Init
initCertificates();
