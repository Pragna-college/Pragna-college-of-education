// Dashboard logic

let monthlyChart, modeChart, batchChart;

async function initDashboard() {
  await initAuth();
  await loadBatches();
  await loadScholarshipLink();
  await loadDashboard();

  document.getElementById('batch-filter').addEventListener('change', loadDashboard);
}

// Load batches into filter dropdown
async function loadBatches() {
  const { data, error } = await supabase.from('batches').select('*').order('year_start');
  if (error || !data) return;

  const select = document.getElementById('batch-filter');
  data.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.label;
    select.appendChild(opt);
  });
}

// Load scholarship link from settings
async function loadScholarshipLink() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'scholarship_url')
    .single();

  if (data?.value) {
    const link = document.getElementById('scholarship-link');
    link.href = data.value;
    link.style.display = 'inline-flex';
  }
}

// Main dashboard loader
async function loadDashboard() {
  const batchId = document.getElementById('batch-filter').value;

  // Build student query
  let studentQuery = supabase.from('students').select('*');
  if (batchId) studentQuery = studentQuery.eq('batch_id', batchId);
  const { data: students } = await studentQuery;

  if (!students || students.length === 0) {
    document.getElementById('total-students').textContent = '0';
    document.getElementById('total-fee').textContent = formatCurrency(0);
    document.getElementById('total-paid').textContent = formatCurrency(0);
    document.getElementById('total-due').textContent = formatCurrency(0);
    document.getElementById('paid-percent').textContent = '0% collected';
    document.getElementById('overdue-count').textContent = 'No students found';
    document.getElementById('recent-payments').innerHTML = '<tr><td colspan="5" class="empty-msg">No payments found</td></tr>';
    document.getElementById('high-due-students').innerHTML = '<tr><td colspan="7" class="empty-msg">No students found</td></tr>';
    return;
  }

  const studentIds = students.map((s) => s.id);

  // Load all payments for these students
  const { data: payments } = await supabase
    .from('fee_payments')
    .select('*, students(name, roll_no)')
    .in('student_id', studentIds)
    .order('payment_date', { ascending: false });

  // Summary calculations
  const totalFee   = students.reduce((s, st) => s + (st.net_payable || 0), 0);
  const totalPaid  = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const totalDue   = totalFee - totalPaid;
  const percent    = totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0;

  // Students with balance > 0
  const paidPerStudent = {};
  (payments || []).forEach((p) => {
    paidPerStudent[p.student_id] = (paidPerStudent[p.student_id] || 0) + p.amount;
  });
  const overdueCount = students.filter(
    (s) => (s.net_payable || 0) - (paidPerStudent[s.id] || 0) > 0
  ).length;

  // Update summary cards
  document.getElementById('total-students').textContent = students.length;
  document.getElementById('total-fee').textContent      = formatCurrency(totalFee);
  document.getElementById('total-paid').textContent     = formatCurrency(totalPaid);
  document.getElementById('total-due').textContent      = formatCurrency(totalDue);
  document.getElementById('paid-percent').textContent   = `${percent}% collected`;
  document.getElementById('overdue-count').textContent  = `${overdueCount} students with pending dues`;
  document.getElementById('batch-label').textContent    = batchId ? '' : 'All Batches';

  // Charts
  renderMonthlyChart(payments || []);
  renderModeChart(payments || []);
  await renderBatchChart();

  // Recent payments table (last 10)
  renderRecentPayments((payments || []).slice(0, 10));

  // High due students (top 10 by balance)
  const studentsWithBalance = students
    .map((s) => ({
      ...s,
      paid: paidPerStudent[s.id] || 0,
      balance: (s.net_payable || 0) - (paidPerStudent[s.id] || 0),
    }))
    .filter((s) => s.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  renderHighDueStudents(studentsWithBalance);
}

// Monthly cash flow bar chart
function renderMonthlyChart(payments) {
  const months = {};
  payments.forEach((p) => {
    const key = p.payment_date?.slice(0, 7);
    if (!key) return;
    months[key] = (months[key] || 0) + p.amount;
  });

  const sorted = Object.keys(months).sort().slice(-12);
  const labels = sorted.map((m) => {
    const [y, mo] = m.split('-');
    return new Date(y, mo - 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  });
  const values = sorted.map((m) => months[m]);

  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(document.getElementById('monthly-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Amount Collected',
        data: values,
        backgroundColor: '#2e86c1',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: {
            callback: (v) => '₹' + v.toLocaleString('en-IN'),
          },
        },
      },
    },
  });
}

// Payment mode pie chart
function renderModeChart(payments) {
  const cash   = payments.filter((p) => p.mode === 'cash').reduce((s, p) => s + p.amount, 0);
  const online = payments.filter((p) => p.mode === 'online').reduce((s, p) => s + p.amount, 0);

  if (modeChart) modeChart.destroy();
  modeChart = new Chart(document.getElementById('mode-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Cash', 'Online'],
      datasets: [{
        data: [cash, online],
        backgroundColor: ['#f39c12', '#27ae60'],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ₹' + ctx.raw.toLocaleString('en-IN'),
          },
        },
      },
    },
  });
}

// Batch-wise collection bar chart
async function renderBatchChart() {
  const { data: batches } = await supabase.from('batches').select('*').order('year_start');
  if (!batches) return;

  const labels    = [];
  const feeData   = [];
  const paidData  = [];

  for (const b of batches) {
    const { data: students } = await supabase
      .from('students')
      .select('id, net_payable')
      .eq('batch_id', b.id);

    if (!students || students.length === 0) continue;

    const ids = students.map((s) => s.id);
    const { data: payments } = await supabase
      .from('fee_payments')
      .select('amount')
      .in('student_id', ids);

    const fee  = students.reduce((s, st) => s + (st.net_payable || 0), 0);
    const paid = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);

    labels.push(b.label);
    feeData.push(fee);
    paidData.push(paid);
  }

  if (batchChart) batchChart.destroy();
  batchChart = new Chart(document.getElementById('batch-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Net Payable',
          data: feeData,
          backgroundColor: '#d6eaf8',
          borderRadius: 6,
        },
        {
          label: 'Paid',
          data: paidData,
          backgroundColor: '#1a5276',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: {
          ticks: {
            callback: (v) => '₹' + v.toLocaleString('en-IN'),
          },
        },
      },
    },
  });
}

// Recent payments table
function renderRecentPayments(payments) {
  const tbody = document.getElementById('recent-payments');
  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No payments yet</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map((p) => `
    <tr>
      <td>${formatDate(p.payment_date)}</td>
      <td>
        <strong>${p.students?.name || '—'}</strong><br>
        <small class="text-muted">${p.students?.roll_no || ''}</small>
      </td>
      <td>${p.receipt_no || '—'}</td>
      <td><strong>${formatCurrency(p.amount)}</strong></td>
      <td>
        <span class="badge ${p.mode === 'cash' ? 'badge-warning' : 'badge-success'}">
          ${p.mode}
        </span>
      </td>
    </tr>
  `).join('');
}

// High due students table
function renderHighDueStudents(students) {
  const tbody = document.getElementById('high-due-students');
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">All students are clear! 🎉</td></tr>';
    return;
  }

  tbody.innerHTML = students.map((s) => {
    const percent = s.net_payable > 0
      ? Math.round((s.paid / s.net_payable) * 100)
      : 0;
    const barClass = percent >= 75 ? '' : percent >= 40 ? 'warning' : 'danger';

    return `
      <tr>
        <td>${s.roll_no}</td>
        <td><a href="student-view.html?id=${s.id}">${s.name}</a></td>
        <td>${s.batch_id || '—'}</td>
        <td>${formatCurrency(s.net_payable)}</td>
        <td>${formatCurrency(s.paid)}</td>
        <td class="text-danger"><strong>${formatCurrency(s.balance)}</strong></td>
        <td style="min-width:100px;">
          <div class="progress">
            <div class="progress-bar ${barClass}" style="width:${percent}%"></div>
          </div>
          <small class="text-muted">${percent}%</small>
        </td>
      </tr>
    `;
  }).join('');
}

// Init
initDashboard();
