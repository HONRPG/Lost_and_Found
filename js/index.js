function showCustomAlert(message, redirectUrl = null, isSuccess = true) {
    try {
        const oldOverlay = document.querySelector('.custom-alert-overlay');
        if (oldOverlay) oldOverlay.remove();

        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';

        const box = document.createElement('div');
        box.className = 'custom-alert-box';
        
        box.innerHTML = `
            <div class="custom-alert-icon">${isSuccess ? '✨' : '⚠️'}</div>
            <h3 class="custom-alert-title">แจ้งเตือนจากระบบ</h3>
            <p class="custom-alert-msg">${message.replace(/\n/g, '<br>')}</p>
            <button class="custom-alert-btn" style="background: linear-gradient(135deg, #00c3ff 0%, #b026ff 100%); color: white; border: none; padding: 10px 30px; border-radius: 8px; cursor: pointer; width: 100%;">ตกลง</button>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        box.querySelector('.custom-alert-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (redirectUrl) window.location.href = redirectUrl;
        });
    } catch (err) {
        alert(message);
        if (redirectUrl) window.location.href = redirectUrl;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let supabase = null;
    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient('https://cpqbtswczohzzswbxteh.supabase.co', 'sb_publishable_ajvfwZ96n4jaFd-2GlGxAQ_F20twafw');
        
        // เช็คว่าใครล็อกอินอยู่
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                const currentUser = session.user;
                
                // สลับเมนูบาร์ให้แสดงชื่อ
                const navLogin = document.getElementById('nav-login');
                const navProfile = document.getElementById('nav-profile');
                if (navLogin) navLogin.style.display = 'none';
                if (navProfile) navProfile.style.display = 'flex';
                
                // ดึงชื่อเต็มมาโชว์
                supabase.from('users').select('full_name').eq('email', currentUser.email).single()
                .then(({ data: userData }) => {
                    const profileName = document.getElementById('profile-name');
                    const profileEmail = document.getElementById('profile-email');
                    if (profileName) profileName.innerText = userData?.full_name || currentUser.user_metadata?.full_name || 'ผู้ใช้งาน';
                    if (profileEmail) profileEmail.innerText = currentUser.email;
                }).catch(e => console.log("Profile error:", e));
            }
        });

        // ดักจับปุ่มออกจากระบบ
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                showCustomAlert('ออกจากระบบสำเร็จ', 'index.html', true);
            });
        }
    }
});