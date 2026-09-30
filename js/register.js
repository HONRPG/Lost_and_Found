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
// 2. ดักจับหน้าสมัครสมาชิก (Register)
// ==========================================
const registerForm = document.getElementById('register-form');
if (registerForm) { // ตรวจสอบว่าอยู่หน้า Register ไหม เพื่อไม่ให้โค้ดพังเวลาอยู่หน้าอื่น
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // หยุดการรีเฟรชหน้า
        
        // ดึงข้อมูลจากช่องต่างๆ
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const password = document.getElementById('reg-pass').value;
        const confirmPass = document.getElementById('reg-confirm').value;

        // ตรวจสอบว่ากรอกครบไหม
        if (!name || !email || !phone || !password || !confirmPass) {
            showCustomAlert('กรุณากรอกข้อมูลให้ครบทุกช่อง!', null, false);
            return;
        }
        if (password !== confirmPass) {
            showCustomAlert('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน!', null, false);
            return;
        }

        // ตรวจสอบว่า Supabase โหลดเข้าเว็บหรือไม่
        if (typeof window.supabase === 'undefined') {
            showCustomAlert('❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้!\nเบราว์เซอร์ของคุณอาจบล็อกการทำงาน หรือไม่มีอินเทอร์เน็ต', null, false);
            return;
        }

        // ถ้าผ่านหมด เริ่มตั้งค่า Supabase และส่งข้อมูล
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.innerText = 'กำลังสมัครสมาชิก...';
        submitBtn.disabled = true;

        try {
            const SUPABASE_URL = 'https://cpqbtswczohzzswbxteh.supabase.co';
            const SUPABASE_ANON_KEY = 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw';
            const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // สมัครบัญชีเข้า Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: { data: { full_name: name } }
            });

            if (authError) {
                submitBtn.innerText = 'ยืนยันการสมัคร';
                submitBtn.disabled = false;
                showCustomAlert(`สมัครไม่สำเร็จ!\n${authError.message}`, null, false);
                return;
            }

            // บันทึกข้อมูลส่วนตัวลงตาราง users
            const { error: dbError } = await supabase.from('users').insert([{ 
                full_name: name, 
                email: email, 
                phone_number: phone, 
                role: 'User' 
            }]);

            if (dbError) {
                submitBtn.innerText = 'ยืนยันการสมัคร';
                submitBtn.disabled = false;
                showCustomAlert(`บันทึกข้อมูลล้มเหลว!\n${dbError.message}`, null, false);
                return;
            }

            // หากผ่านหมด เด้งป็อบอัพและพาไปหน้า Login
            showCustomAlert('สมัครสมาชิกสำเร็จ!\nกรุณาเข้าสู่ระบบด้วยอีเมลสถาบัน', 'login.html', true);

        } catch (err) {
            submitBtn.innerText = 'ยืนยันการสมัคร';
            submitBtn.disabled = false;
            showCustomAlert(`เกิดข้อผิดพลาดรุนแรง!\n${err.message}`, null, false);
        }
    });
}

// ฟังก์ชันสำหรับเปิด-ปิดการแสดงรหัสผ่าน
function togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
        input.type = 'password';
        iconElement.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
}