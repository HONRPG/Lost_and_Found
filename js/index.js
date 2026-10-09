// ==========================================
// CONFIG - Supabase
// ==========================================
const SUPABASE_URL = 'https://cpqbtswczohzzswbxteh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw';

let supabaseClient = null;
let currentUser = null;
let currentClaimItemId = null;
let allItems = []; // เก็บไว้สำหรับ filter + stats

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    await checkAuthState();
    if (typeof flatpickr !== 'undefined') {
        flatpickr('#search-date', { dateFormat: 'Y-m-d', locale: 'th' });
    }
    await loadItemsFromSupabase();
    setupTrackingTab();
});

// ==========================================
// AUTH
// ==========================================
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
    if (currentUser) {
        if (navLogin) navLogin.style.display = 'none';
        if (navProfile) navProfile.style.display = 'flex';
        const profileEmail = document.getElementById('profile-email');
        const profileName = document.getElementById('profile-name');
        if (profileEmail) profileEmail.textContent = currentUser.email || '';
        const meta = currentUser.user_metadata;
        if (profileName) profileName.textContent = meta?.full_name || meta?.name || currentUser.email?.split('@')[0] || 'ผู้ใช้งาน';
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

// ==========================================
// LOAD & STATS
// ==========================================
async function loadItemsFromSupabase() {
    const feedGrid = document.getElementById('feed-grid');
    if (!feedGrid) return;
    feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#888;"><div style="font-size:2.5rem;margin-bottom:12px;">⏳</div><p>กำลังโหลดข้อมูล...</p></div>';
    setStats('—', '—', '—');

    if (!supabaseClient) {
        feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#f55;"><p>❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p></div>';
        return;
    }
    const { data: items, error } = await supabaseClient
        .from('items')
        .select('*')
        .neq('item_status', 'approved')
        .order('incident_datetime', { ascending: false });

    if (error) {
        feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#f55;"><p>เกิดข้อผิดพลาด: ' + error.message + '</p></div>';
        return;
    }

    allItems = items || [];
    renderFeed(allItems);
    updateStats(allItems);
    subscribeRealtime();
}

function renderFeed(items) {
    const feedGrid = document.getElementById('feed-grid');
    if (!feedGrid) return;
    feedGrid.innerHTML = '';
    if (!items || items.length === 0) {
        feedGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:#888;"><div style="font-size:3rem;margin-bottom:15px;">💭</div><p>ยังไม่มีรายการในระบบ</p></div>';
    } else {
        items.forEach(item => feedGrid.appendChild(createCardFromDB(item)));
    }
    const countEl = document.getElementById('feed-count');
    if (countEl) countEl.textContent = (items?.length || 0) + ' รายการ';
}


function updateStats(items) {
    const total = items.length;
    const found = items.filter(i => i.item_type === 'Found').length;
    setStats(total, found);
}

function setStats(total, found) {
    const elTotal = document.getElementById('stat-total');
    const elFound = document.getElementById('stat-found');
    if (elTotal) elTotal.textContent = total;
    if (elFound) elFound.textContent = found;
}

function subscribeRealtime() {
    if (!supabaseClient) return;
    supabaseClient.channel('items-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items' }, payload => {
            allItems.unshift(payload.new);
            const feedGrid = document.getElementById('feed-grid');
            if (feedGrid) feedGrid.insertBefore(createCardFromDB(payload.new), feedGrid.firstChild);
            updateStats(allItems);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items' }, payload => {
            if (payload.new.item_status === 'approved') {
                allItems = allItems.filter(i => i.item_id !== payload.new.item_id);
                const oldCard = document.querySelector('.feed-grid .card[data-id="' + payload.new.item_id + '"]');
                if (oldCard) oldCard.remove();
            } else {
                const idx = allItems.findIndex(i => i.item_id === payload.new.item_id);
                if (idx !== -1) allItems[idx] = payload.new;
                const old = document.querySelector('.feed-grid .card[data-id="' + payload.new.item_id + '"]');
                if (old) old.replaceWith(createCardFromDB(payload.new));
            }
            updateStats(allItems);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, payload => {
            allItems = allItems.filter(i => i.item_id !== payload.old.item_id);
            const oldCard = document.querySelector('.feed-grid .card[data-id="' + payload.old.item_id + '"]');
            if (oldCard) oldCard.remove();
            updateStats(allItems);
        })
        .subscribe();
}

// ==========================================
// CARD CREATION
// ==========================================
const categoryMap = {
    electronics: '📱 อุปกรณ์อิเล็กทรอนิกส์',
    documents:   '📄 เอกสาร/บัตร',
    accessories: '👜 กระเป๋า/เครื่องประดับ',
    clothing:    '👕 เสื้อผ้า',
    keys:        '🔑 กุญแจ',
    others:      '📦 อื่นๆ'
};

const categoryMapShort = {
    electronics: 'อิเล็กทรอนิกส์',
    documents:   'เอกสาร/บัตร',
    accessories: 'กระเป๋า',
    clothing:    'เสื้อผ้า',
    keys:        'กุญแจ',
    others:      'อื่นๆ'
};

function createCardFromDB(item) {
    const isFound = item.item_type === 'Found';
    const typeLabel = isFound ? '✅ พบของ' : '🔴 ของหาย';
    const typeClass = isFound ? 'found' : 'lost';
    const barClass  = isFound ? 'found-bar' : 'lost-bar';

    let statusLabel = isFound ? 'อยู่ที่จุดรับฝาก' : 'กำลังตามหา';
    if (item.item_status === 'pending')  statusLabel = '⏳ มีผู้ขอรับคืน (รอตรวจสอบ)';
    if (item.item_status === 'approved') statusLabel = '✅ คืนเจ้าของแล้ว';
    if (item.item_status === 'rejected') statusLabel = '❌ ถูกปฏิเสธ';

    const timeFormatted = formatThaiDate(new Date(item.incident_datetime));
    const catIcon = categoryMap[item.category] || ('📦 ' + item.category);
    const catShort = categoryMapShort[item.category] || item.category;
    const dateShort = formatShortDate(new Date(item.incident_datetime));

    const canClaim  = isFound && item.item_status === 'available';
    const isPending = isFound && item.item_status === 'pending';
    const isApproved = item.item_status === 'approved';

    let claimBtn = '';
    if (isFound) {
        if (isApproved) {
            claimBtn = '<button class="btn-claim" style="background:rgba(46,213,115,0.15);color:#2ed573;border:1px solid rgba(46,213,115,0.3);cursor:default;" disabled>คืนแล้ว</button>';
        } else if (isPending) {
            claimBtn = '<button class="btn-claim" style="background:rgba(255,152,0,0.1);color:#ff9800;border:1px solid rgba(255,152,0,0.3);cursor:not-allowed;" disabled>กำลังดำเนินการ</button>';
        } else if (canClaim) {
            claimBtn = '<button class="btn-claim" onclick="openClaimModal(\'' + item.item_id + '\')">✋ ขอรับคืน</button>';
        }
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-id', item.item_id);
    card.setAttribute('data-category', item.category);
    card.setAttribute('data-type', item.item_type.toLowerCase());
    card.setAttribute('data-date', item.incident_datetime);

    card.innerHTML =
        '<div class="card-top-bar ' + barClass + '"></div>' +
        '<div class="card-inner">' +
          '<div class="card-header-row">' +
            '<span class="badge ' + typeClass + '">' + typeLabel + '</span>' +
            '<span class="card-date">' + dateShort + '</span>' +
          '</div>' +
          '<h3 class="card-title">' + escapeHtml(item.item_name) + '</h3>' +
          '<div class="card-meta">' +
            '<span class="category-tag" onclick="filterCategory(\'' + item.category + '\')">' + catIcon + '</span>' +
          '</div>' +
          '<div class="card-info">' +
            '<div class="info-row"><span class="info-icon">📍</span><span>' + escapeHtml(item.location || '-') + '</span></div>' +
            '<div class="info-row"><span class="info-icon">🕒</span><span>' + timeFormatted + '</span></div>' +
            '<div class="info-row"><span class="info-icon">📌</span><span>' + statusLabel + '</span></div>' +
          '</div>' +
          '<div class="card-actions">' +
            '<button class="btn-details" onclick="openDetailModal(\'' + item.item_id + '\')">🔍 รายละเอียด</button>' +
            claimBtn +
          '</div>' +
        '</div>';

    return card;
}

// ==========================================
// FILTER (Category + Type)
// ==========================================
function filterCategory(categoryValue, tabEl) {
    // อัปเดต hidden select
    const select = document.getElementById('search-category');
    if (select) select.value = categoryValue;

    // อัปเดต showcase buttons active state
    document.querySelectorAll('.cat-showcase-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === categoryValue);
    });

    // อัปเดต cat-tab active state (legacy)
    if (tabEl && tabEl.classList.contains('cat-tab')) {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
    }

    applyFilters();
}

function filterType(typeValue, btnEl) {
    if (btnEl) {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
        // sync data-type for applyFilters
        document.querySelectorAll('.type-btn').forEach(b => b.removeAttribute('data-type-active'));
        btnEl.setAttribute('data-type-active', typeValue);
    }
    applyFilters();
}

function applyFilters() {
    const activeCat  = (document.getElementById('search-category')?.value || 'all');
    const activeType = document.querySelector('.type-btn.active')?.dataset?.type || 'all';
    const searchText = (document.getElementById('search-text')?.value || '').toLowerCase();
    const searchLoc  = (document.getElementById('search-location')?.value || '').toLowerCase();

    document.querySelectorAll('.feed-grid .card').forEach(card => {
        const cat  = card.getAttribute('data-category') || '';
        const type = card.getAttribute('data-type') || '';
        const title = card.querySelector('.card-title')?.textContent?.toLowerCase() || '';
        const loc   = card.querySelector('.info-row span:last-child')?.textContent?.toLowerCase() || '';

        const matchCat  = activeCat  === 'all' || cat  === activeCat;
        const matchType = activeType === 'all' || type === activeType;
        const matchText = !searchText || title.includes(searchText);
        const matchLoc  = !searchLoc  || loc.includes(searchLoc);

        card.style.display = (matchCat && matchType && matchText && matchLoc) ? '' : 'none';
    });

    // อัปเดต count
    const visible = document.querySelectorAll('.feed-grid .card:not([style*="none"])').length;
    const countEl = document.getElementById('feed-count');
    if (countEl) countEl.textContent = visible + ' รายการ';
}

function clearFilters() {
    const searchText = document.getElementById('search-text');
    const searchLoc  = document.getElementById('search-location');
    const searchCat  = document.getElementById('search-category');
    if (searchText) searchText.value = '';
    if (searchLoc)  searchLoc.value  = '';
    if (searchCat)  searchCat.value  = 'all';

    document.querySelectorAll('.cat-showcase-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === 'all');
    });
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.type-btn[data-type="all"]');
    if (allBtn) allBtn.classList.add('active');

    applyFilters();
}

// ==========================================
// MODAL - DETAIL & CLAIM
// ==========================================
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
    if (item.item_status === 'pending')  statusLabel = '⏳ มีผู้ขอรับคืน (รอตรวจสอบ)';
    if (item.item_status === 'approved') statusLabel = '✅ คืนเจ้าของแล้ว';

    document.getElementById('modalTitle').innerText = item.item_name;
    const badge = document.getElementById('modalBadge');
    badge.innerText = typeLabel;
    badge.className = 'badge ' + item.item_type.toLowerCase();
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

    const btn = document.querySelector('#modalClaimSection .full-width-btn');
    if (btn) {
        btn.textContent = '⏳ กำลังส่งข้อมูล...';
        btn.style.opacity = '0.7';
        btn.style.pointerEvents = 'none';
    }

    const { error } = await supabaseClient.from('claims').insert({
        item_id: currentClaimItemId,
        user_id: currentUser.id,
        proof_details: claimText,
        claim_status: 'pending'
    });

    if (error) {
        if (btn) {
            btn.textContent = 'ยืนยันสิทธิ์';
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
        alert('เกิดข้อผิดพลาด: ' + error.message);
        return;
    }

    await supabaseClient.from('items').update({ item_status: 'pending' }).eq('item_id', currentClaimItemId);
    delete detailCache[currentClaimItemId];

    const idx = allItems.findIndex(i => i.item_id == currentClaimItemId);
    if (idx !== -1) {
        allItems[idx] = { ...allItems[idx], item_status: 'pending' };
        const card = document.querySelector('.feed-grid .card[data-id="' + currentClaimItemId + '"]');
        if (card) card.replaceWith(createCardFromDB(allItems[idx]));
    }

    if (btn) {
        btn.textContent = 'ยืนยันสิทธิ์';
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }

    closeModal();
    document.getElementById('successModal').style.display = 'block';
    currentClaimItemId = null;
    await loadMyClaimsTab();
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

// ==========================================
// TRACKING PANEL
// ==========================================
function setupTrackingTab() {
    const nav = document.querySelector('.nav-links');
    if (!nav || document.getElementById('nav-track')) return;
    const trackLink = document.createElement('a');
    trackLink.id = 'nav-track';
    trackLink.href = '#';
    trackLink.textContent = '📋 ติดตามสถานะ';
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
        header.innerHTML = '<h3 style="margin:0;color:#fff;font-size:1.1rem;">📋 ติดตามสถานะคำขอ</h3><button onclick="toggleTrackingPanel()" style="background:none;border:none;color:#aaa;font-size:1.5rem;cursor:pointer;">✕</button>';
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
        approved: { label: '✅ อนุมัติแล้ว',  color: '#4caf50', bg: 'rgba(76,175,80,0.1)'  },
        rejected: { label: '❌ ถูกปฏิเสธ',   color: '#f44336', bg: 'rgba(244,67,54,0.1)'  }
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

// ==========================================
// UTILITY
// ==========================================
function formatThaiDate(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return '-';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return dateObj.getDate() + ' ' + months[dateObj.getMonth()] + ' ' + (dateObj.getFullYear()+543) + ' · ' + String(dateObj.getHours()).padStart(2,'0') + ':' + String(dateObj.getMinutes()).padStart(2,'0') + ' น.';
}

function formatShortDate(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return '-';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return dateObj.getDate() + ' ' + months[dateObj.getMonth()];
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
