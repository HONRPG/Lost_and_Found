// ==========================================
// CONFIG - Supabase
// ==========================================
const SUPABASE_URL = 'https://cpqbtswczohzzswbxteh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw';

let supabaseClient = null;
let currentUser = null;
let currentClaimItemId = null;

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    await checkAuthState();
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#input-time", { enableTime: true, dateFormat: "Y-m-d H:i", locale: "th", time_24hr: true, defaultDate: new Date() });
        flatpickr("#search-date", { dateFormat: "Y-m-d", locale: "th" });
    }
    await loadItemsFromSupabase();
    setupTrackingTab();
    setupFileInput();
    setupReportForm();
});

async function checkAuthState() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    renderNavProfile();
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        renderNavProfile();
    });
}

function renderNavProfile() {
    const navLogin = document.getElementById('nav-login');
    const navProfile = document.getElementById('nav-profile');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    if (currentUser) {
        if (navLogin) navLogin.style.display = 'none';
        if (navProfile) navProfile.style.display = 'flex';
        if (profileEmail) profileEmail.textContent = currentUser.email || '';
        const meta = currentUser.user_metadata;
        if (profileName) profileName.textContent = (meta?.full_name || meta?.name || currentUser.email?.split('@')[0] || 'ผู้ใช้งาน');
    } else {
        if (navLogin) navLogin.style.display = 'block';
        if (navProfile) navProfile.style.display = 'none';
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (supabaseClient) await supabaseClient.auth.signOut();
            window.location.reload();
        };
    }
}

async function loadItemsFromSupabase() {
    const feedGrid = document.getElementById('feed-grid');
    if (!feedGrid) return;
    feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#888;"><p>กำลังโหลดข้อมูล...</p></div>';
    if (!supabaseClient) {
        feedGrid.innerHTML = '<p style="color:#f55;text-align:center;grid-column:1/-1;">ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p>';
        return;
    }
    const { data: items, error } = await supabaseClient
        .from('items')
        .select('*')
        .order('incident_datetime', { ascending: false });
    if (error) {
        console.error(error);
        feedGrid.innerHTML = '<p style="color:#f55;text-align:center;grid-column:1/-1;">เกิดข้อผิดพลาด: ' + error.message + '</p>';
        return;
    }
    feedGrid.innerHTML = '';
    if (!items || items.length === 0) {
        feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#888;"><div style="font-size:3rem;margin-bottom:15px;">💭</div><p>ยังไม่มีรายการในระบบ</p></div>';
        return;
    }
    items.forEach(item => { feedGrid.appendChild(createCardFromDB(item)); });
    subscribeRealtime();
}

function subscribeRealtime() {
    if (!supabaseClient) return;
    supabaseClient.channel('items-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items' }, payload => {
            const feedGrid = document.getElementById('feed-grid');
            feedGrid.insertBefore(createCardFromDB(payload.new), feedGrid.firstChild);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items' }, payload => {
            const old = document.querySelector('.feed-grid .card[data-id="' + payload.new.item_id + '"]');
            if (old) old.replaceWith(createCardFromDB(payload.new));
        })
        .subscribe();
}

const categoryMap = {
    electronics: 'อุปกรณ์อิเล็กทรอนิกส์',
    documents: 'เอกสาร/บัตร',
    accessories: 'กระเป๋า/เครื่องประดับ',
    others: 'อื่นๆ'
};

function createCardFromDB(item) {
    const isFound = item.item_type === 'Found';
    const typeLabel = isFound ? 'พบของ (Found)' : 'ของหาย (Lost)';
    let statusLabel = isFound ? 'อยู่ที่จุดรับฝาก' : 'กำลังตามหา';
    if (item.item_status === 'pending') statusLabel = 'มีผู้ขอรับคืน (รอตรวจสอบ)';
    else if (item.item_status === 'approved') statusLabel = '✅ คืนเจ้าของแล้ว';
    else if (item.item_status === 'rejected') statusLabel = '❌ ถูกปฏิเสธ';
    const timeFormatted = formatThaiDate(new Date(item.incident_datetime));
    const categoryText = categoryMap[item.category] || item.category;
    const canClaim = isFound && item.item_status === 'available';
    const isPending = isFound && item.item_status === 'pending';
    const isApproved = item.item_status === 'approved';
    let actionHTML = '';
    const detailBtn = '<button class="btn-details" onclick="openDetailModal(\'' + item.item_id + '\')">ดูรายละเอียด</button>';
    if (isFound) {
        if (isApproved) {
            actionHTML = '<div class="card-actions">' + detailBtn + '<button class="btn-claim" style="background:#2a7a2a;cursor:default;" disabled>คืนแล้ว</button></div>';
        } else if (isPending) {
            actionHTML = '<div class="card-actions">' + detailBtn + '<button class="btn-claim" style="background:#555;cursor:not-allowed;" disabled>กำลังดำเนินการ</button></div>';
        } else if (canClaim) {
            actionHTML = '<div class="card-actions">' + detailBtn + '<button class="btn-claim" onclick="openClaimModal(\'' + item.item_id + '\')">ขอรับคืน</button></div>';
        }
    } else {
        actionHTML = '<div class="card-actions">' + detailBtn + '</div>';
    }
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-id', item.item_id);
    card.setAttribute('data-category', item.category);
    card.setAttribute('data-date', item.incident_datetime);
    card.innerHTML =
        '<span class="badge ' + item.item_type.toLowerCase() + '">' + typeLabel + '</span>' +
        '<h3>' + escapeHtml(item.item_name) + '</h3>' +
        '<span class="category-tag" onclick="filterCategory(\'' + item.category + '\')">🏷️ ' + categoryText + '</span>' +
        '<p>📍 สถานที่: ' + escapeHtml(item.location || '-') + '</p>' +
        '<p>🕒 เวลา: ' + timeFormatted + '</p>' +
        '<p>📌 สถานะ: ' + statusLabel + '</p>' +
        actionHTML;
    return card;
}

const detailCache = {};

async function openDetailModal(itemId) {
    if (!supabaseClient) return;
    let item = detailCache[itemId];
    if (!item) {
        const { data, error } = await supabaseClient.from('items').select('*').eq('item_id', itemId).single();
        if (error || !data) { alert('ไม่สามารถโหลดข้อมูลได้'); return; }
        item = data; detailCache[itemId] = item;
    }
    const isFound = item.item_type === 'Found';
    const typeLabel = isFound ? 'พบของ (Found)' : 'ของหาย (Lost)';
    let statusLabel = isFound ? 'อยู่ที่จุดรับฝาก' : 'กำลังตามหา';
    if (item.item_status === 'pending') statusLabel = 'มีผู้ขอรับคืน (รอตรวจสอบ)';
    else if (item.item_status === 'approved') statusLabel = '✅ คืนเจ้าของแล้ว';
    document.getElementById('modalTitle').innerText = item.item_name;
    const badge = document.getElementById('modalBadge');
    badge.innerText = typeLabel; badge.className = 'badge ' + item.item_type.toLowerCase();
    document.getElementById('modalLocation').innerText = item.location || '-';
    document.getElementById('modalTime').innerText = formatThaiDate(new Date(item.incident_datetime));
    document.getElementById('modalStatus').innerText = statusLabel;
    document.getElementById('modalDesc').innerText = item.public_details?.trim() ? item.public_details : 'ไม่มีรายละเอียดเพิ่มเติม';
    const imgEl = document.getElementById('modalImage');
    if (item.image_url?.trim()) { imgEl.src = item.image_url; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
    document.getElementById('modalClaimSection').style.display = (isFound && item.item_status === 'available') ? 'block' : 'none';
    currentClaimItemId = isFound ? itemId : null;
    document.getElementById('itemModal').style.display = 'block';
}

function openClaimModal(itemId) { currentClaimItemId = itemId; openDetailModal(itemId); }

async function submitClaim() {
    const claimText = document.getElementById('claimInput').value.trim();
    if (!claimText) { alert('กรุณาระบุข้อมูลเพื่อยืนยันตัวตน'); return; }
    if (!currentUser) { alert('กรุณาเข้าสู่ระบบก่อน'); closeModal(); window.location.href = 'login.html'; return; }
    if (!supabaseClient || !currentClaimItemId) return;
    const { error } = await supabaseClient.from('claims').insert({
        item_id: currentClaimItemId,
        user_id: currentUser.id,
        proof_details: claimText,
        claim_status: 'pending'
    });
    if (error) { alert('Error: ' + error.message); return; }
    await supabaseClient.from('items').update({ item_status: 'pending' }).eq('item_id', currentClaimItemId);
    delete detailCache[currentClaimItemId];
    const card = document.querySelector('.feed-grid .card[data-id="' + currentClaimItemId + '"]');
    if (card) {
        card.querySelectorAll('p').forEach(p => { if (p.innerText.includes('📌')) p.innerText = '📌 สถานะ: มีผู้ขอรับคืน (รอตรวจสอบ)'; });
        const btn = card.querySelector('.btn-claim');
        if (btn) { btn.innerText = 'กำลังดำเนินการ'; btn.style.background = '#555'; btn.style.cursor = 'not-allowed'; btn.disabled = true; btn.removeAttribute('onclick'); }
    }
    document.getElementById('itemModal').style.display = 'none';
    document.getElementById('claimInput').value = '';
    document.getElementById('successModal').style.display = 'block';
    currentClaimItemId = null;
    await loadMyClaimsTab();
}

function setupFileInput() {
    const fileInput = document.getElementById('input-image');
    if (!fileInput) return;
    fileInput.addEventListener('change', function () {
        const display = document.getElementById('file-name-display');
        if (this.files?.length > 0) { display.textContent = 'เลือกไฟล์: ' + this.files[0].name; display.classList.add('file-name-active'); }
        else { display.textContent = 'คลิกเพื่ออัปโหลดรูปภาพ'; display.classList.remove('file-name-active'); }
    });
}

function setupReportForm() {
    const reportForm = document.getElementById('report-form');
    if (!reportForm) return;
    reportForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!currentUser) { alert('กรุณาเข้าสู่ระบบก่อนโพสต์'); window.location.href = 'login.html'; return; }
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = 'กำลังบันทึก...';
        const typeValue = document.getElementById('input-type').value;
        const categorySelect = document.getElementById('input-category');
        const categoryValue = categorySelect.value;
        const name = document.getElementById('input-name').value.trim();
        let timeRaw = document.getElementById('input-time').value;
        const location = document.getElementById('input-location').value.trim();
        const publicDesc = document.getElementById('input-desc').value;
        const secretTextarea = document.querySelector('textarea[placeholder*="รหัสปลดล็อก"]');
        const secretInfo = secretTextarea ? secretTextarea.value : '';
        if (!timeRaw) {
            const now = new Date();
            timeRaw = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        }
        let imageUrl = '';
        const imageInput = document.getElementById('input-image');
        if (imageInput.files && imageInput.files[0]) { imageUrl = await compressImage(imageInput.files[0]); }
        const incidentDatetime = new Date(timeRaw.replace(/-/g, '/')).toISOString();
        const payload = {
            item_type: typeValue,
            category: categoryValue,
            item_name: name,
            incident_datetime: incidentDatetime,
            location: location,
            public_details: publicDesc,
            secret_details: secretInfo,
            image_url: imageUrl,
            item_status: 'available'
        };
        const { error } = await supabaseClient.from('items').insert(payload);
        submitBtn.disabled = false; submitBtn.textContent = 'โพสต์แจ้งข้อมูล';
        if (error) { alert('Error: ' + error.message); return; }
        this.reset();
        if (document.querySelector("#input-time")?._flatpickr) document.querySelector("#input-time")._flatpickr.setDate(new Date());
        const d = document.getElementById('file-name-display');
        if (d) { d.textContent = 'คลิกเพื่ออัปโหลดรูปภาพ'; d.classList.remove('file-name-active'); }
        alert('โพสต์สำเร็จ!');
        document.querySelector('.search-section')?.scrollIntoView({ behavior: 'smooth' });
    });
}

function setupTrackingTab() {
    const nav = document.querySelector('.nav-links');
    if (!nav || document.getElementById('nav-track')) return;
    const trackLink = document.createElement('a');
    trackLink.id = 'nav-track';
    trackLink.href = '#';
    trackLink.textContent = 'ติดตามสถานะ';
    trackLink.style.cursor = 'pointer';
    trackLink.onclick = (e) => { e.preventDefault(); toggleTrackingPanel(); };
    const navActions = nav.querySelector('.nav-actions') || nav.lastElementChild;
    nav.insertBefore(trackLink, navActions);
    if (!document.getElementById('tracking-panel')) {
        const panel = document.createElement('div');
        panel.id = 'tracking-panel';
        panel.style.cssText = 'display:none;position:fixed;top:0;right:0;width:420px;max-width:100vw;height:100vh;background:linear-gradient(160deg,#0f0f1a 0%,#1a1a2e 100%);border-left:1px solid #333;z-index:9999;overflow-y:auto;box-shadow:-5px 0 30px rgba(0,0,0,0.5);font-family:Prompt,sans-serif;';
        const header = document.createElement('div');
        header.style.cssText = 'padding:20px 24px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:#0f0f1a;z-index:1;';
        header.innerHTML = '<h3 style="margin:0;color:#fff;font-size:1.1rem;">ติดตามสถานะคำขอ</h3><button onclick="toggleTrackingPanel()" style="background:none;border:none;color:#aaa;font-size:1.5rem;cursor:pointer;">✕</button>';
        const body = document.createElement('div');
        body.id = 'tracking-content';
        body.style.cssText = 'padding:20px 24px;';
        body.innerHTML = '<p style="color:#888;text-align:center;">กำลังโหลด...</p>';
        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);
    }
}

function toggleTrackingPanel() {
    const panel = document.getElementById('tracking-panel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) loadMyClaimsTab();
}

async function loadMyClaimsTab() {
    const content = document.getElementById('tracking-content');
    if (!content) return;
    if (!currentUser) {
        content.innerHTML = '<div style="text-align:center;padding:40px 0;"><div style="font-size:3rem;margin-bottom:15px;">🔒</div><p style="color:#aaa;margin-bottom:20px;">กรุณาเข้าสู่ระบบเพื่อดูสถานะคำขอ</p><a href="login.html" style="background:linear-gradient(135deg,#00c3ff,#b026ff);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">เข้าสู่ระบบ</a></div>';
        return;
    }
    content.innerHTML = '<p style="color:#888;text-align:center;">⏳ กำลังโหลด...</p>';
    if (!supabaseClient) return;
    const { data: claims, error } = await supabaseClient
        .from('claims')
        .select('*, items(*)')
        .eq('user_id', currentUser.id)
        .order('claim_datetime', { ascending: false });
    if (error) { content.innerHTML = '<p style="color:#f55;">Error: ' + error.message + '</p>'; return; }
    if (!claims || claims.length === 0) {
        content.innerHTML = '<div style="text-align:center;padding:40px 0;"><div style="font-size:3rem;margin-bottom:15px;">💭</div><p style="color:#888;">ยังไม่มีคำขอรับคืนสิ่งของ</p></div>';
        return;
    }
    const sMap = {
        pending:  { label: '⏳ รอตรวจสอบ', color: '#ff9800', bg: 'rgba(255,152,0,0.1)' },
        approved: { label: '✅ อนุมัติแล้ว',    color: '#4caf50', bg: 'rgba(76,175,80,0.1)' },
        rejected: { label: '❌ ถูกปฏิเสธ',      color: '#f44336', bg: 'rgba(244,67,54,0.1)' }
    };
    let html = '';
    claims.forEach(claim => {
        const itm = claim.items;
        const s = sMap[claim.claim_status] || { label: claim.claim_status, color: '#aaa', bg: 'transparent' };
        const dateStr = formatThaiDate(new Date(claim.claim_datetime));
        html += '<div style="background:#1e1e30;border:1px solid #2a2a42;border-radius:12px;padding:18px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">';
        html += '<div style="flex:1;"><h4 style="margin:0 0 6px;color:#fff;font-size:0.95rem;">' + escapeHtml(itm?.item_name || '-') + '</h4>';
        html += '<p style="margin:0 0 3px;color:#888;font-size:0.8rem;">📍 ' + escapeHtml(itm?.location || '-') + '</p>';
        html += '<p style="margin:0;color:#666;font-size:0.78rem;">🗓️ ยื่นเมื่อ: ' + dateStr + '</p></div>';
        html += '<span style="background:' + s.bg + ';color:' + s.color + ';border:1px solid ' + s.color + ';padding:4px 10px;border-radius:20px;font-size:0.78rem;font-weight:bold;flex-shrink:0;">' + s.label + '</span></div>';
        if (claim.claim_status === 'approved') html += '<div style="margin-top:10px;padding:10px;background:rgba(76,175,80,0.08);border:1px solid #2d5a2d;border-radius:8px;color:#81c784;font-size:0.85rem;">🎉 อนุมัติแล้ว! ติดต่อรับสิ่งของที่จุดรับฝาก</div>';
        if (claim.claim_status === 'rejected') html += '<div style="margin-top:10px;padding:10px;background:rgba(244,67,54,0.08);border:1px solid #5a2d2d;border-radius:8px;color:#e57373;font-size:0.85rem;">❌ ข้อมูลไม่ตรงกัน กรุณาตรวจสอบและลองใหม่</div>';
        html += '</div>';
    });
    content.innerHTML = html;
}

function filterCategory(categoryValue) {
    const select = document.getElementById('search-category');
    if (select) select.value = categoryValue;
    document.querySelectorAll('.feed-grid .card').forEach(card => {
        card.style.display = (categoryValue === 'all' || card.getAttribute('data-category') === categoryValue) ? 'block' : 'none';
    });
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    const ci = document.getElementById('claimInput');
    if (ci) ci.value = '';
    currentClaimItemId = null;
}

function closeSuccessModal() { document.getElementById('successModal').style.display = 'none'; }

window.onclick = function (event) {
    const itemModal = document.getElementById('itemModal');
    const successModal = document.getElementById('successModal');
    if (event.target === itemModal) closeModal();
    if (event.target === successModal) closeSuccessModal();
};

function formatThaiDate(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return '-';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return dateObj.getDate() + ' ' + months[dateObj.getMonth()] + ' ' + (dateObj.getFullYear()+543) + ' - ' + String(dateObj.getHours()).padStart(2,'0') + ':' + String(dateObj.getMinutes()).padStart(2,'0') + ' น.';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800;
                let w = img.width, h = img.height;
                if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
        reader.onerror = error => reject(error);
    });
}
