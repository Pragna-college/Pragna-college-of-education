// Audit log page logic

let allLogs = [];
let displayedLogs = [];
const PAGE_SIZE = 50;
let currentPage = 1;

async function initAudit() {
  await initAuth();
  await loadAuditLogs();
  setupEventListeners();
}

// Load audit logs
async function loadAuditLogs() {
  showLoading('audit-table', 'Loading audit logs...');

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('done_at', { ascending: false })
    .limit(500);

  if (error) {
    showError('audit-table', 'Failed to load audit logs.');
    return;
  }

  allLogs = data || [];
  currentPage = 1;
  renderLogs();
}

// Render logs with filters
function renderLogs() {
  const search    = document.getElementById('search-input').value.toLowerCase();
  const table     = document.getElementById('table-filter').value;
  const action    = document.getElementById('action-filter').value;
  const fromDate  = document.getElementById('from-date').value;
  const toDate    = document.getElementById('to-date').value;

  let filtered = allLogs.filter((log) => {
    const matchSearch = !search ||
      log.done_by?.toLowerCase().includes(search) ||
      log.table_name?.toLowerCase().includes(search);
    const matchTable  = !table  || log.table_name === table;
    const matchAction = !action || log.action === action;
    const logDate     = log.done_at?.split('T')[0];
    const matchFrom   = !fromDate || logDate >= fromDate;
    const matchTo     = !toDate   || logDate <= toDate;
    return matchSearch && matchTable && matchAction && matchFrom && matchTo;
  });

  displayedLogs = filtered;
  const paginated = filtered.slice(0, PAGE_SIZE * currentPage);

  const tbody = document.getElementById('audit-table');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No audit logs found</td></tr>';
    document.getElementById('load-more-wrap').style.display = 'none';
    return;
  }

  tbody.innerHTML = paginated.map((log) => {
    const actionBadge = {
      INSERT: '<span class="badge badge-success">Added</span>',
      UPDATE: '<span class="badge badge-warning">Edited</span>',
      DELETE: '<span class="badge badge-danger">Deleted</span>',
    }[log.action] || `<span class="badge badge-muted">${log.action}</span>`;

    const tableLabel = {
      students:     '👤 Students',
      fee_payments: '💰 Payments',
      certificates: '📄 Certificates',
    }[log.table_name] || log.table_name;

    const summary = getLogSummary(log);

    return `
      <tr>
        <td>
          <strong>${formatDate(log.done_at?.split('T')[0])}</strong><br>
          <small class="text-muted">${formatTime(log.done_at)}</small>
        </td>
        <td>${actionBadge}</td>
        <td>${tableLabel}</td>
        <td><small>${log.done_by || '—'}</small></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <small>${summary}</small>
            <button class="btn btn-outline btn-sm" onclick="openDetail('${log.id}')">
              View
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Load more button
  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (filtered.length > PAGE_SIZE * currentPage) {
    loadMoreWrap.style.display = 'block';
  } else {
    loadMoreWrap.style.display = 'none';
  }
}

// Get short summary of what changed
function getLogSummary(log) {
  if (log.action === 'INSERT' && log.new_data) {
    const d = log.new_data;
    if (log.table_name === 'students')     return `Added student: ${d.name || ''} (${d.roll_no || ''})`;
    if (log.table_name === 'fee_payments') return `Payment of ₹${d.amount || ''} recorded`;
    if (log.table_name === 'certificates') return `${d.type || ''} certificate added`;
  }
  if (log.action === 'UPDATE' && log.new_data) {
    const d = log.new_data;
    if (log.table_name === 'students')     return `Updated student: ${d.name || ''}`;
    if (log.table_name === 'fee_payments') return `Payment updated: ₹${d.amount || ''}`;
    if (log.table_name === 'certificates') return `${d.type || ''} certificate updated`;
  }
  if (log.action === 'DELETE' && log.old_data) {
    const d = log.old_data;
    if (log.table_name === 'students')     return `Deleted student: ${d.name || ''} (${d.roll_no || ''})`;
    if (log.table_name === 'fee_payments') return `Payment of ₹${d.amount || ''} deleted`;
    if (log.table_name === 'certificates') return `${d.type || ''} certificate deleted`;
  }
  return '—';
}

// Format time from ISO string
function formatTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Open detail modal
function openDetail(id) {
  const log = allLogs.find((l) => l.id === id);
  if (!log) return;

  const content = document.getElementById('detail-content');

  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div class="flex justify-between mb-1">
        <span class="text-muted">Action:</span>
        <strong>${log.action}</strong>
      </div>
      <div class="flex justify-between mb-1">
        <span class="text-muted">Table:</span>
        <strong>${log.table_name}</strong>
      </div>
      <div class="flex justify-between mb-1">
        <span class="text-muted">Done By:</span>
        <strong>${log.done_by || '—'}</strong>
      </div>
      <div class="flex justify-between mb-1">
        <span class="text-muted">Date & Time:</span>
        <strong>${formatDateTime(log.done_at)}</strong>
      </div>
    </div>

    ${log.old_data ? `
      <div style="margin-bottom:16px;">
        <div style="font-weight:600;margin-bottom:8px;color:var(--danger);">Before</div>
        <pre style="background:#fff5f5;padding:12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;border:1px solid #fadbd8;">${JSON.stringify(log.old_data, null, 2)}</pre>
      </div>
    ` : ''}

    ${log.new_data ? `
      <div>
        <div style="font-weight:600;margin-bottom:8px;color:var(--success);">After</div>
        <pre style="background:#f0fff4;padding:12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;border:1px solid #d5f5e3;">${JSON.stringify(log.new_data, null, 2)}</pre>
      </div>
    ` : ''}
  `;

  document.getElementById('detail-modal').classList.add('open');
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('refresh-btn').addEventListener('click', loadAuditLogs);

  document.getElementById('detail-modal-close').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.remove('open');
  });
  document.getElementById('detail-close-btn').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.remove('open');
  });

  document.getElementById('load-more-btn').addEventListener('click', () => {
    currentPage++;
    renderLogs();
  });

  // Filters
  document.getElementById('search-input').addEventListener('input', debounce(renderLogs));
  document.getElementById('table-filter').addEventListener('change', renderLogs);
  document.getElementById('action-filter').addEventListener('change', renderLogs);
  document.getElementById('from-date').addEventListener('change', renderLogs);
  document.getElementById('to-date').addEventListener('change', renderLogs);
}

// Init
initAudit();
