function showCustomAlert(message, redirectUrl = null, isSuccess = true) {
    try {
        const oldOverlay = document.querySelector('.custom-alert-overlay');
        if (oldOverlay) oldOverlay.remove();

        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';

        const box = document.createElement('div');
        box.className = 'custom-alert-box';
        const icon = isSuccess ? '✨' : '⚠️';

        box.innerHTML = `
            <div class="custom-alert-icon">${icon}</div>
            <h3 class="custom-alert-title">แจ้งเตือนจากระบบ</h3>
            <p class="custom-alert-msg">${message.replace(/\n/g, '<br>')}</p>
            <button class="custom-alert-btn" style="background: linear-gradient(135deg, #00c3ff 0%, #b026ff 100%); color: white; border: none; padding: 10px 30px; border-radius: 8px; cursor: pointer; width: 100%;">ตกลง</button>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const btn = box.querySelector('.custom-alert-btn');
        btn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (redirectUrl) window.location.href = redirectUrl;
        });
    } catch (err) {
        // ถ้า CSS ของป็อบอัพพัง ให้ใช้ alert พื้นฐานแทน
        alert(message);
        if (redirectUrl) window.location.href = redirectUrl;
    }
}
// ==========================================
// 3. ดักจับหน้าเข้าสู่ระบบ (Login)
// ==========================================
const loginForm = document.getElementById('login-form');
if (loginForm) { // ตรวจสอบว่าอยู่หน้า Login ไหม
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // หยุดการรีเฟรชหน้า

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-pass').value;

        if (!email || !password) {
            showCustomAlert('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน!', null, false);
            return;
        }

        if (typeof window.supabase === 'undefined') {
            showCustomAlert('❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้!', null, false);
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.innerText = 'กำลังตรวจสอบ...';
        submitBtn.disabled = true;

        try {
            const SUPABASE_URL = 'https://cpqbtswczohzzswbxteh.supabase.co';
            const SUPABASE_ANON_KEY = 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw';
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                submitBtn.innerText = 'เข้าสู่ระบบ';
                submitBtn.disabled = false;
                showCustomAlert(`เข้าสู่ระบบล้มเหลว!\nอีเมลหรือรหัสผ่านไม่ถูกต้อง`, null, false);
                return;
            }

            showCustomAlert('เข้าสู่ระบบสำเร็จ!\nกำลังพากลับไปหน้าหลัก...', 'index.html', true);

        } catch (err) {
            submitBtn.innerText = 'เข้าสู่ระบบ';
            submitBtn.disabled = false;
            showCustomAlert(`เกิดข้อผิดพลาดรุนแรง!\n${err.message}`, null, false);
        }
    });
}