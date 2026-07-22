// Payments page logic

let allPayments = [];
let allStudents = [];
let deletePaymentId = null;

async function initPayments() {
  await initAuth();

  // Hide summary cards for staff
  const role = await getUserRole();
  if (role === 'staff') {
    const summaryCards = document.getElementById('payments-summary');
    if (summaryCards) summaryCards.style.display = 'none';
  }
  await loadBatches();
  await loadStudents();
  await loadPayments();
  setupEventListeners();

  // If coming from students page with ?student=id
  const params = new URLSearchParams(window.location.search);
  const studentId = params.get('student');
  if (studentId) {
    document.getElementById('add-payment-btn').click();
    document.getElementById('student-select').value = studentId;
    await loadStudentSummary(studentId);
  }
}

// Load batches into filter
async function loadBatches() {
  const { data } = await supabase.from('batches').select('*').order('year_start');
  if (!data) return;

  const select = document.getElementById('batch-filter');
  data.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.label;
    select.appendChild(opt);
  });
}

// Load students into select
async function loadStudents() {
  const { data } = await supabase
    .from('students')
    .select('id, name, roll_no, batch_id, net_payable, total_fee, concession, batches(label)')
    .order('name');

  allStudents = data || [];

  const select = document.getElementById('student-select');
  allStudents.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.roll_no} — ${s.name}`;
    opt.dataset.batchId = s.batch_id;
    select.appendChild(opt);
  });
}

// Load all payments
async function loadPayments() {
  showLoading('payments-table', 'Loading payments...');

  const { data, error } = await supabase
    .from('fee_payments')
    .select('*, students(name, roll_no, batch_id, batches(label))')
    .order('payment_date', { ascending: false });

  if (error) {
    showError('payments-table', 'Failed to load payments.');
    return;
  }

  allPayments = data || [];
  renderPayments();
}

// Render payments table with filters
function renderPayments() {
  const search   = document.getElementById('search-input').value.toLowerCase();
  const batchId  = document.getElementById('batch-filter').value;
  const mode     = document.getElementById('mode-filter').value;
  const fromDate = document.getElementById('from-date').value;
  const toDate   = document.getElementById('to-date').value;

  let filtered = allPayments.filter((p) => {
    const matchSearch = !search ||
      p.students?.name?.toLowerCase().includes(search) ||
      p.students?.roll_no?.toLowerCase().includes(search) ||
      p.receipt_no?.toLowerCase().includes(search);
    const matchBatch  = !batchId || p.students?.batch_id === batchId;
    const matchMode   = !mode || p.mode === mode;
    const matchFrom   = !fromDate || p.payment_date >= fromDate;
    const matchTo     = !toDate   || p.payment_date <= toDate;
    return matchSearch && matchBatch && matchMode && matchFrom && matchTo;
  });

  // Update summary cards
  const totalCollected = filtered.reduce((s, p) => s + (p.amount || 0), 0);
  const cashPayments   = filtered.filter((p) => p.mode === 'cash');
  const onlinePayments = filtered.filter((p) => p.mode === 'online');
  const totalCash      = cashPayments.reduce((s, p) => s + p.amount, 0);
  const totalOnline    = onlinePayments.reduce((s, p) => s + p.amount, 0);

  document.getElementById('total-collected').textContent  = formatCurrency(totalCollected);
  document.getElementById('total-cash').textContent       = formatCurrency(totalCash);
  document.getElementById('total-online').textContent     = formatCurrency(totalOnline);
  document.getElementById('total-transactions').textContent = filtered.length;
  document.getElementById('cash-count').textContent       = `${cashPayments.length} transactions`;
  document.getElementById('online-count').textContent     = `${onlinePayments.length} transactions`;

  const tbody = document.getElementById('payments-table');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No payments found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((p) => `
    <tr>
      <td>${formatDate(p.payment_date)}</td>
      <td>
        <strong>${p.students?.name || '—'}</strong><br>
        <small class="text-muted">${p.students?.roll_no || ''}</small>
      </td>
      <td><span class="badge badge-info">${p.students?.batches?.label || '—'}</span></td>
      <td><span class="badge badge-muted">Fee Payment</span></td>
      <td>${p.receipt_no || '—'}</td>
      <td><strong>${formatCurrency(p.amount)}</strong></td>
      <td>
        <span class="badge ${p.mode === 'cash' ? 'badge-warning' : 'badge-success'}">
          ${p.mode}
        </span>
      </td>
      <td><small>${p.notes || '—'}</small></td>
      <td><small class="text-muted">${p.recorded_by || '—'}</small></td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-outline btn-sm" onclick="openEdit('${p.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="openDelete('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Load student fee summary in modal
async function loadStudentSummary(studentId) {
  if (!studentId) {
    document.getElementById('student-summary').style.display = 'none';
    return;
  }

  const student = allStudents.find((s) => s.id === studentId);
  if (!student) return;

  const { data: payments } = await supabase
    .from('fee_payments')
    .select('amount')
    .eq('student_id', studentId);

  const paid    = (payments || []).reduce((s, p) => s + p.amount, 0);
  const balance = (student.net_payable || 0) - paid;
  const percent = student.net_payable > 0
    ? Math.min(100, Math.round((paid / student.net_payable) * 100))
    : 0;

  document.getElementById('summary-net').textContent     = formatCurrency(student.net_payable);
  document.getElementById('summary-paid').textContent    = formatCurrency(paid);
  document.getElementById('summary-balance').textContent = formatCurrency(balance);
  document.getElementById('summary-bar').style.width     = percent + '%';

  const bar = document.getElementById('summary-bar');
  bar.className = 'progress-bar';
  if (percent < 40) bar.classList.add('danger');
  else if (percent < 75) bar.classList.add('warning');

  document.getElementById('student-summary').style.display = 'block';    const { data: history } = await supabase     .from('fee_payments')     .select('payment_date, amount, mode, receipt_no, payment_type')     .eq('student_id', studentId)     .order('payment_date', { ascending: false });    const historyEl = document.getElementById('student-payment-history');   if (!history || !history.length) {     historyEl.innerHTML = '<p class="text-muted" style="font-size:0.85rem;margin:8px 0 0;">No past payments recorded.</p>';   } else {     historyEl.innerHTML = `       <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">         <div style="font-weight:600;font-size:0.85rem;margin-bottom:6px;color:var(--primary);">Past Payments</div>         <div style="max-height:160px;overflow-y:auto;">           <table style="width:100%;font-size:0.82rem;">             <thead>               <tr style="color:var(--text-muted);">                 <th style="padding:4px 6px;text-align:left;">Date</th>                 <th style="padding:4px 6px;text-align:left;">Type</th>                 <th style="padding:4px 6px;text-align:left;">Mode</th>                 <th style="padding:4px 6px;text-align:left;">Receipt</th>                 <th style="padding:4px 6px;text-align:right;">Amount</th>               </tr>             </thead>             <tbody>               ${history.map(p => `                 <tr style="border-top:1px solid var(--border);">                   <td style="padding:4px 6px;">${formatDate(p.payment_date)}</td>                   <td style="padding:4px 6px;">${p.payment_type || '—'}</td>                   <td style="padding:4px 6px;">                     <span class="badge ${p.mode === 'cash' ? 'badge-warning' : 'badge-success'}" style="font-size:0.75rem;">                       ${p.mode}                     </span>                   </td>                   <td style="padding:4px 6px;">${p.receipt_no || '—'}</td>                   <td style="padding:4px 6px;text-align:right;font-weight:600;">${formatCurrency(p.amount)}</td>                 </tr>               `).join('')}             </tbody>           </table>         </div>       </div>     `;   }
}

// Open add modal
async function openAdd() {
  document.getElementById('modal-title').textContent  = 'Record Payment';
  document.getElementById('payment-id').value         = '';
  document.getElementById('student-select').value     = '';
  document.getElementById('payment-amount').value     = '';
  document.getElementById('payment-mode').value       = '';
  document.getElementById('payment-date').value       = new Date().toISOString().split('T')[0];
  document.getElementById('receipt-no').value         = '';
  document.getElementById('payment-notes').value      = '';
  document.getElementById('student-summary').style.display = 'none';
  document.getElementById('payment-modal').classList.add('open');
}

// Open edit modal
async function openEdit(id) {
  const payment = allPayments.find((p) => p.id === id);
  if (!payment) return;

  document.getElementById('modal-title').textContent  = 'Edit Payment';
  document.getElementById('payment-id').value         = payment.id;
  document.getElementById('student-select').value     = payment.student_id;
  document.getElementById('payment-amount').value     = payment.amount;
  document.getElementById('payment-mode').value       = payment.mode;
  document.getElementById('payment-date').value       = payment.payment_date;
  document.getElementById('receipt-no').value         = payment.receipt_no || '';
  document.getElementById('payment-notes').value      = payment.notes || '';

  await loadStudentSummary(payment.student_id);
  document.getElementById('payment-modal').classList.add('open');
}

// Close modal
function closeModal() {
  document.getElementById('payment-modal').classList.remove('open');
}

// Save payment
async function savePayment() {
  const id          = document.getElementById('payment-id').value;
  const studentId   = document.getElementById('student-select').value;
  const paymentType = document.getElementById('payment-type').value;
  const amount      = parseFloat(document.getElementById('payment-amount').value);
  const mode        = document.getElementById('payment-mode').value;
  const date        = document.getElementById('payment-date').value;
  const receiptNo   = document.getElementById('receipt-no').value.trim();
  const notes       = document.getElementById('payment-notes').value.trim();

  if (!studentId || !paymentType) {
    showToast('Please select a Student and Payment Type.', 'danger');
    return;
  }

  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount.', 'danger');
    return;
  }

  // Concession does not need a date or mode — it's a discount not a payment
  if (paymentType !== 'Concession' && !date) {
    showToast('Please select a payment date.', 'danger');
    return;
  }

  if (paymentType !== 'Concession' && !mode) {
    showToast('Please select a payment mode.', 'danger');
    return;
  }

  if (amount <= 0) {
    showToast('Amount must be greater than 0.', 'danger');
    return;
  }

  const user = await getCurrentUser();

  const payload = {
    student_id:    studentId,
    payment_type:  paymentType || null,
    amount,
    mode,
    payment_date:  date,
    receipt_no:    receiptNo || null,
    notes:         notes || null,
    recorded_by:   user?.email || 'unknown',
  };

  const btn = document.getElementById('save-payment-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (paymentType === 'Concession') {
      // Concession is a discount — update student record directly
      const student = allStudents.find(s => s.id === studentId);
      if (!student) throw new Error('Student not found');

      const currentConcession = student.concession || 0;
      const newConcession = currentConcession + amount;

      // Only update concession — net_payable is auto-calculated by Supabase
      const { error } = await supabase
        .from('students')
        .update({ concession: newConcession })
        .eq('id', studentId);

      if (error) throw error;

      await writeAudit(
        'students',
        'UPDATE',
        {
          concession: currentConcession,
          name: student.name
        },
        {
          concession: newConcession,
          name: student.name,
          change_reason: 'Concession applied'
        }
      );

      // Update local cache
      student.concession = newConcession;

      showToast(`Concession of ${formatCurrency(amount)} applied to ${student.name}.`);
      closeModal();
      await loadPayments();

    } else {
      // Normal payment — add to fee_payments
      if (id) {
        const old = allPayments.find((p) => p.id === id);
        const { error } = await supabase.from('fee_payments').update(payload).eq('id', id);
        if (error) throw error;
        await writeAudit('fee_payments', 'UPDATE', old, { ...old, ...payload });
        showToast('Payment updated successfully!');
      } else {
        const { error } = await supabase.from('fee_payments').insert(payload);
        if (error) throw error;
        await writeAudit('fee_payments', 'INSERT', null, payload);
        showToast('Payment recorded successfully!');
      }
      closeModal();
      await loadPayments();
    }

  } catch (err) {
    showToast(err.message || 'Failed to save payment.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Payment';
  }
}

// Open delete confirm
function openDelete(id) {
  deletePaymentId = id;
  document.getElementById('delete-modal').classList.add('open');
}

// Confirm delete
async function confirmDelete() {
  if (!deletePaymentId) return;

  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const old = allPayments.find((p) => p.id === deletePaymentId);
    const { error } = await supabase.from('fee_payments').delete().eq('id', deletePaymentId);
    if (error) throw error;
    await writeAudit('fee_payments', 'DELETE', old, null);
    showToast('Payment deleted.');
    document.getElementById('delete-modal').classList.remove('open');
    deletePaymentId = null;
    await loadPayments();
  } catch (err) {
    showToast(err.message || 'Failed to delete payment.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('add-payment-btn').addEventListener('click', openAdd);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('save-payment-btn').addEventListener('click', savePayment);
  document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);
  document.getElementById('delete-modal-close').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('open');
  });
  document.getElementById('delete-cancel-btn').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.remove('open');
  });

  // Filters
  document.getElementById('search-input').addEventListener('input', debounce(renderPayments));
  document.getElementById('batch-filter').addEventListener('change', renderPayments);
  document.getElementById('mode-filter').addEventListener('change', renderPayments);
  document.getElementById('from-date').addEventListener('change', renderPayments);
  document.getElementById('to-date').addEventListener('change', renderPayments);

  // Student select — load summary
  document.getElementById('student-select').addEventListener('change', (e) => {
    loadStudentSummary(e.target.value);
  });

  // When Concession is selected, update summary label
  document.getElementById('payment-type').addEventListener('change', (e) => {
    const isConcession = e.target.value === 'Concession';
    const modeGroup = document.getElementById('payment-mode').closest('.form-group');
    const receiptGroup = document.getElementById('receipt-no').closest('.form-group');
    if (isConcession) {
      modeGroup.style.opacity = '0.4';
      modeGroup.style.pointerEvents = 'none';
      receiptGroup.style.opacity = '0.4';
      receiptGroup.style.pointerEvents = 'none';
      document.getElementById('payment-mode').value = 'cash';
      document.querySelector('label[for="payment-amount"]') &&
        (document.querySelector('#payment-amount').previousElementSibling.textContent = 'Concession Amount (₹) *');
    } else {
      modeGroup.style.opacity = '';
      modeGroup.style.pointerEvents = '';
      receiptGroup.style.opacity = '';
      receiptGroup.style.pointerEvents = '';
      const lbl = document.querySelector('.form-group label');
    }
  });
}

// Init
initPayments();
