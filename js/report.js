// ==========================================
// report.js — หน้าแจ้งของหาย/พบของ
// ==========================================
const SUPABASE_URL = 'https://cpqbtswczohzzswbxteh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw';

let supabaseClient = null;
let currentUser = null;

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    await checkAuthState();

    if (typeof flatpickr !== 'undefined') {
        flatpickr('#input-time', {
            enableTime: true,
            dateFormat: 'Y-m-d H:i',
            locale: 'th',
            time_24hr: true,
            defaultDate: new Date(),
            maxDate: new Date(),
            onOpen: function(selectedDates, dateStr, instance) {
                instance.set('maxDate', new Date());
            }
        });
    }

    setupFileInput();
    setupReportForm();
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
    renderAuthWarning();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        renderNavProfile();
        renderAuthWarning();
    });
}

function renderNavProfile() {
    const navLogin = document.getElementById('nav-login');
    const navProfile = document.getElementById('nav-profile');
    if (currentUser) {
        if (navLogin) navLogin.style.display = 'none';
        if (navProfile) navProfile.style.display = 'flex';
        const profileEmail = document.getElementById('profile-email');
        const profileName  = document.getElementById('profile-name');
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

function renderAuthWarning() {
    const warning = document.getElementById('auth-warning');
    const form = document.getElementById('report-form');
    if (!warning || !form) return;
    if (!currentUser) {
        warning.style.display = 'flex';
        form.style.opacity = '0.4';
        form.style.pointerEvents = 'none';
    } else {
        warning.style.display = 'none';
        form.style.opacity = '1';
        form.style.pointerEvents = '';
    }
}

// ==========================================
// TYPE SELECTOR (radio cards)
// ==========================================
function setupTypeSelector() {
    // Type is now fixed to Found — no-op
}

// ==========================================
// FILE INPUT
// ==========================================
function setupFileInput() {
    const fileInput = document.getElementById('input-image');
    if (!fileInput) return;
    fileInput.addEventListener('change', function () {
        const display = document.getElementById('file-name-display');
        if (this.files?.length > 0) {
            display.textContent = '✅ ' + this.files[0].name;
            display.classList.add('file-name-active');
        } else {
            display.textContent = 'คลิกหรือลากรูปมาวางที่นี่';
            display.classList.remove('file-name-active');
        }
    });
}

// ==========================================
// FORM SUBMIT
// ==========================================
function setupReportForm() {
    const reportForm = document.getElementById('report-form');
    if (!reportForm) return;

    reportForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!currentUser) {
            alert('กรุณาเข้าสู่ระบบก่อนโพสต์');
            window.location.href = 'login.html';
            return;
        }

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ กำลังบันทึก...';

        const typeValue   = document.getElementById('input-type').value;
        const catValue    = document.getElementById('input-category').value;
        const name        = document.getElementById('input-name').value.trim();
        let   timeRaw     = document.getElementById('input-time').value;
        const location    = document.getElementById('input-location').value.trim();
        const publicDesc  = document.getElementById('input-desc').value.trim();
        const secretInfo  = document.getElementById('input-secret').value.trim();

        if (!name || !location || !secretInfo) {
            alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบ (ชื่อสิ่งของ, สถานที่, ข้อมูลลับ)');
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 โพสต์แจ้งข้อมูล';
            return;
        }

        if (!timeRaw) {
            const now = new Date();
            timeRaw = now.getFullYear() + '-' +
                      String(now.getMonth()+1).padStart(2,'0') + '-' +
                      String(now.getDate()).padStart(2,'0') + ' ' +
                      String(now.getHours()).padStart(2,'0') + ':' +
                      String(now.getMinutes()).padStart(2,'0');
        }

        let imageUrl = '';
        const imageInput = document.getElementById('input-image');
        if (imageInput.files && imageInput.files[0]) {
            imageUrl = await compressImage(imageInput.files[0]);
        }

        const incidentDatetime = new Date(timeRaw.replace(/-/g, '/')).toISOString();
        const payload = {
            item_type:          typeValue,
            category:           catValue,
            item_name:          name,
            incident_datetime:  incidentDatetime,
            location:           location,
            public_details:     publicDesc,
            secret_details:     secretInfo,
            image_url:          imageUrl,
            item_status:        'available'
        };

        const { error } = await supabaseClient.from('items').insert(payload);
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 โพสต์แจ้งข้อมูล';

        if (error) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
            return;
        }

        // แสดง success
        reportForm.closest('.form-panel').style.display = 'none';
        document.getElementById('success-alert').style.display = 'block';
    });
}

function resetSuccessAlert() {
    document.getElementById('report-form').reset();
    if (document.querySelector('#input-time')?._flatpickr) {
        document.querySelector('#input-time')._flatpickr.setDate(new Date());
    }
    const d = document.getElementById('file-name-display');
    if (d) { d.textContent = 'คลิกหรือลากรูปมาวางที่นี่'; d.classList.remove('file-name-active'); }

    document.getElementById('success-alert').style.display = 'none';
    document.querySelector('.form-panel').style.display = 'block';
    setupTypeSelector();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// TRACKING TAB (same as index.js)
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
        const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const d = new Date(claim.claim_datetime);
        const dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear()+543);
        html += '<div style="background:#1e1e30;border:1px solid #2a2a42;border-radius:12px;padding:18px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">';
        html += '<div style="flex:1;"><h4 style="margin:0 0 6px;color:#fff;font-size:0.95rem;">' + (itm?.item_name || '-') + '</h4>';
        html += '<p style="margin:0 0 3px;color:#888;font-size:0.8rem;">📍 ' + (itm?.location || '-') + '</p>';
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
                if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } }
                else       { if (h > MAX) { w *= MAX/h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
        reader.onerror = error => reject(error);
    });
}
