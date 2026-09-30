// ==========================================
// Admin.js — Lost & Found Admin Panel
// ==========================================
const SUPABASE_URL = 'https://cpqbtswczohzzswbxteh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw';

// รายการ email ที่เป็น Admin (เพิ่ม email admin ของคุณที่นี่)
const ADMIN_EMAILS = ['admin@up.ac.th', 'admin@lostfound.ac.th'];

let supabaseClient = null;
let allClaims = [];
let currentFilter = 'all';

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    await checkAdminAuth();
});

async function checkAdminAuth() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) { window.location.href = 'login.html'; return; }
    const user = session.user;
    const isAdmin = ADMIN_EMAILS.includes(user.email) || user.user_metadata?.role === 'admin';
    const adminEmailEl = document.getElementById('admin-email');
    if (adminEmailEl) adminEmailEl.textContent = user.email;
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) logoutBtn.onclick = async () => { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; };
    if (!isAdmin) { document.getElementById('blocked-state').style.display = 'block'; return; }
    document.getElementById('admin-content').style.display = 'block';
    await loadClaims();
    subscribeAdminRealtime();
}

async function loadClaims() {
    const loading = document.getElementById('claims-loading');
    const table = document.getElementById('claims-table');
    const empty = document.getElementById('claims-empty');
    if (loading) loading.style.display = 'block';
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('claims')
        .select('*, items(*)')
        .order('claim_datetime', { ascending: false });

    if (error) { alert('เกิดข้อผิดพลาด: ' + error.message); return; }
    allClaims = data || [];
    updateStats();
    renderClaims(allClaims);
}

function updateStats() {
    document.getElementById('stat-total').textContent = allClaims.length;
    document.getElementById('stat-pending').textContent = allClaims.filter(c => c.claim_status === 'pending').length;
    document.getElementById('stat-approved').textContent = allClaims.filter(c => c.claim_status === 'approved').length;
    document.getElementById('stat-rejected').textContent = allClaims.filter(c => c.claim_status === 'rejected').length;
}

function filterClaims(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('filter-' + status);
    if (btn) btn.classList.add('active');
    const filtered = status === 'all' ? allClaims : allClaims.filter(c => c.claim_status === status);
    renderClaims(filtered);
}

function renderClaims(claims) {
    const loading = document.getElementById('claims-loading');
    const table = document.getElementById('claims-table');
    const empty = document.getElementById('claims-empty');
    const tbody = document.getElementById('claims-tbody');
    if (loading) loading.style.display = 'none';
    if (!claims || claims.length === 0) {
        if (empty) empty.style.display = 'block';
        if (table) table.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    if (table) table.style.display = 'table';

    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    function fmt(d) {
        if (!d) return '-';
        const dt = new Date(d);
        return dt.getDate() + ' ' + months[dt.getMonth()] + ' ' + (dt.getFullYear()+543);
    }
    function esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    tbody.innerHTML = '';
    claims.forEach(claim => {
        const item = claim.items;
        const isPending = claim.claim_status === 'pending';
        const statusLabel = { pending: '⏳ รอตรวจสอบ', approved: '✅ อนุมัติแล้ว', rejected: '❌ ถูกปฏิเสธ' }[claim.claim_status] || claim.claim_status;

        const row = document.createElement('tr');
        row.setAttribute('data-claim-id', claim.claim_id);
row.innerHTML =
            '<td>' +
            '<div class="item-name">' + esc(item?.item_name || '—') + '</div>' +
            '<div class="item-loc">📍 ' + esc(item?.location || '-') + '</div>' +
            (item?.image_url ? '<img src="' + esc(item.image_url) + '" class="item-thumb" onerror="this.style.display=\'none\'">' : '') +
            '</td>' +
            '<td><div class="user-id-text">' + esc(claim.user_id || '—') + '</div></td>' +
            '<td>' +
            '<div class="secret-note" id="secret-' + claim.claim_id + '" style="display:none;">' + esc(item?.secret_details || '(ไม่มีข้อมูลลับ)') + '</div>' +
            '<button class="secret-toggle" onclick="toggleSecret(\'' + claim.claim_id + '\')">👁 ดูข้อมูลลับ</button>' +
            '</td>' +
            '<td><div class="claim-note-text">' + esc(claim.proof_details || '—') + '</div></td>' +
            '<td><span class="claim-date">' + fmt(claim.claim_datetime) + '</span></td>' +
            '<td><span class="status-pill ' + claim.claim_status + '">' + statusLabel + '</span></td>' +
            '<td>' +
            (isPending ?
                '<div class="action-row">' +
                '<button class="btn-approve" onclick="approveClaim(\'' + claim.claim_id + '\', \'' + (item?.item_id || '') + '\')">✅ อนุมัติ</button>' +
                '<button class="btn-reject" onclick="rejectClaim(\'' + claim.claim_id + '\', \'' + (item?.item_id || '') + '\')">❌ ปฏิเสธ</button>' +
                '</div>'
                : '<span class="done-label">ดำเนินการแล้ว</span>') +
            '</td>';
        tbody.appendChild(row);
    });
}

function toggleSecret(claimId) {
    const el = document.getElementById('secret-' + claimId);
    const btn = el?.nextElementSibling;
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (btn) btn.textContent = isHidden ? '🙈 ซ่อน' : '👁 ดูข้อมูลลับ';
}

async function approveClaim(claimId, itemId) {
    if (!confirm('ยืนยันการอนุมัติคำขอนี้?')) return;
    if (!supabaseClient) return;
    const { error: ce } = await supabaseClient.from('claims').update({ claim_status: 'approved' }).eq('claim_id', claimId);
    if (ce) { alert('เกิดข้อผิดพลาด: ' + ce.message); return; }
    if (itemId) await supabaseClient.from('items').update({ item_status: 'approved' }).eq('item_id', itemId);
    showToast('✅ อนุมัติคำขอเรียบร้อยแล้ว');
    await loadClaims();
    filterClaims(currentFilter);
}

async function rejectClaim(claimId, itemId) {
    if (!confirm('ยืนยันการปฏิเสธคำขอนี้?')) return;
    if (!supabaseClient) return;
    const { error: ce } = await supabaseClient.from('claims').update({ claim_status: 'rejected' }).eq('claim_id', claimId);
    if (ce) { alert('เกิดข้อผิดพลาด: ' + ce.message); return; }
    if (itemId) await supabaseClient.from('items').update({ item_status: 'available' }).eq('item_id', itemId);
    showToast('❌ ปฏิเสธคำขอเรียบร้อยแล้ว');
    await loadClaims();
    filterClaims(currentFilter);
}

function subscribeAdminRealtime() {
    if (!supabaseClient) return;
    supabaseClient.channel('admin-claims')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, async () => {
            await loadClaims();
            filterClaims(currentFilter);
        })
        .subscribe();
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:#1e1e30;border:1px solid #333;color:#fff;padding:14px 22px;border-radius:10px;z-index:99999;font-family:Prompt,sans-serif;font-size:0.9rem;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
