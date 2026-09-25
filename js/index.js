// เริ่มต้น Flatpickr
flatpickr("#input-time", { enableTime: true, dateFormat: "Y-m-d H:i", locale: "th", time_24hr: true, defaultDate: new Date() });
flatpickr("#search-date", { dateFormat: "Y-m-d", locale: "th" });

let currentClaimId = null; 

// ฟังก์ชันโหลดและลบโพสต์ที่หมดอายุ
function initializePosts() {
    const now = new Date();
    const maxAgeMs = 14 * 24 * 60 * 60 * 1000; 

    const staticCards = document.querySelectorAll('.feed-grid .card');
    staticCards.forEach(card => {
        const dateString = card.getAttribute('data-date');
        if (dateString && (now - new Date(dateString) > maxAgeMs)) {
            card.remove();
        }
    });

    let savedPosts = JSON.parse(localStorage.getItem('lf_posts')) || [];
    const validPosts = savedPosts.filter(post => {
        return (now - new Date(post.dateStr) <= maxAgeMs);
    });

    if(validPosts.length !== savedPosts.length) {
        localStorage.setItem('lf_posts', JSON.stringify(validPosts));
    }

    const feedGrid = document.getElementById('feed-grid');
    validPosts.forEach(post => {
        const card = createCardElement(post);
        feedGrid.insertBefore(card, feedGrid.firstChild);
    });
}

window.addEventListener('DOMContentLoaded', initializePosts);

document.getElementById('input-image').addEventListener('change', function(e) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (this.files && this.files.length > 0) {
        fileNameDisplay.textContent = 'เลือกไฟล์: ' + this.files[0].name;
        fileNameDisplay.classList.add('file-name-active');
    } else {
        fileNameDisplay.textContent = 'คลิกเพื่ออัปโหลดรูปภาพ';
        fileNameDisplay.classList.remove('file-name-active');
    }
});

// บีบอัดรูปภาพ
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                const MAX_HEIGHT = 800; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
        reader.onerror = error => reject(error);
    });
}

// สร้างการ์ดและจัดการปุ่มตามสถานะ claimStatus
function createCardElement(post) {
    const isFound = (post.typeValue === 'found');
    const typeLabel = isFound ? 'พบของ (Found)' : 'ของหาย (Lost)';
    
    // เช็คว่ามีสถานะ claimStatus เป็น pending หรือไม่
    let statusLabel = isFound ? 'อยู่ที่จุดรับฝาก' : 'กำลังตามหา';
    if (post.claimStatus === 'pending') {
        statusLabel = 'กำลังดำเนินการ';
    }
    
    const dateObj = new Date(post.timeRaw.replace(/-/g, '/')); 
    const timeFormatted = `${dateObj.getDate()} ก.ย. ${dateObj.getFullYear() + 543} - ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')} น.`;

    let actionButtonsHTML = '';
    if (isFound) {
        if (post.claimStatus === 'pending') {
            // หากอยู่ในสถานะกำลังดำเนินการ จะปรับปุ่มขอรับคืนให้กดไม่ได้
            actionButtonsHTML = `
                <div class="card-actions">
                    <button class="btn-details" onclick="openModal('${post.name}', '${typeLabel}', '${post.typeValue}', '${post.location}', '${timeFormatted}', '${statusLabel}', '${post.desc}', '${post.imageUrl}', true, '${post.dateStr}')">ดูรายละเอียด</button>
                    <button class="btn-claim" style="background: #555; cursor: not-allowed;" disabled>กำลังดำเนินการ</button>
                </div>
            `;
        } else {
            actionButtonsHTML = `
                <div class="card-actions">
                    <button class="btn-details" onclick="openModal('${post.name}', '${typeLabel}', '${post.typeValue}', '${post.location}', '${timeFormatted}', '${statusLabel}', '${post.desc}', '${post.imageUrl}', true, '${post.dateStr}')">ดูรายละเอียด</button>
                    <button class="btn-claim" onclick="openModal('${post.name}', '${typeLabel}', '${post.typeValue}', '${post.location}', '${timeFormatted}', '${statusLabel}', '${post.desc}', '${post.imageUrl}', true, '${post.dateStr}')">ขอรับคืน</button>
                </div>
            `;
        }
    } else {
        actionButtonsHTML = `
            <div class="card-actions">
                <button class="btn-details" onclick="openModal('${post.name}', '${typeLabel}', '${post.typeValue}', '${post.location}', '${timeFormatted}', '${statusLabel}', '${post.desc}', '${post.imageUrl}', false, '${post.dateStr}')">ดูรายละเอียด</button>
            </div>
        `;
    }

    const newCard = document.createElement('div');
    newCard.className = 'card';
    newCard.setAttribute('data-category', post.categoryValue);
    newCard.setAttribute('data-date', post.dateStr); 
    
    newCard.innerHTML = `
        <span class="badge ${post.typeValue}">${typeLabel}</span>
        <h3>${post.name}</h3>
        <span class="category-tag" onclick="filterCategory('${post.categoryValue}')">🏷️ ${post.categoryText}</span>
        <p>📍 สถานที่: ${post.location}</p>
        <p>🕒 เวลา: ${timeFormatted}</p>
        <p>📌 สถานะ: ${statusLabel}</p>
        ${actionButtonsHTML}
    `;
    return newCard;
}

function filterCategory(categoryValue) {
    document.getElementById('search-category').value = categoryValue;
    
    const cards = document.querySelectorAll('.feed-grid .card');
    cards.forEach(card => {
        const cardCat = card.getAttribute('data-category');
        if (categoryValue === 'all' || cardCat === categoryValue) {
            card.style.display = 'block'; 
        } else {
            card.style.display = 'none'; 
        }
    });
}

function openModal(title, type, typeClass, location, time, status, desc, imgSrc, isFound, uniqueId) {
    currentClaimId = uniqueId; 
    document.getElementById('modalTitle').innerText = title;
    const badge = document.getElementById('modalBadge');
    badge.innerText = type;
    badge.className = 'badge ' + typeClass;
    document.getElementById('modalLocation').innerText = location;
    document.getElementById('modalTime').innerText = time;
    document.getElementById('modalStatus').innerText = status;
    document.getElementById('modalDesc').innerText = desc.trim() !== '' ? desc : 'ไม่มีรายละเอียดเพิ่มเติม';
    
    const imgElement = document.getElementById('modalImage');
    if(imgSrc && imgSrc.trim() !== '' && imgSrc !== 'undefined') { 
        imgElement.src = imgSrc; 
        imgElement.style.display = 'block'; 
    } else { 
        imgElement.style.display = 'none'; 
    }

    document.getElementById('modalClaimSection').style.display = isFound ? 'block' : 'none';
    document.getElementById('itemModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
    document.getElementById('claimInput').value = '';
    currentClaimId = null;
}

function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

window.onclick = function(event) {
    const itemModal = document.getElementById('itemModal');
    const successModal = document.getElementById('successModal');
    if (event.target == itemModal) { closeModal(); }
    if (event.target == successModal) { closeSuccessModal(); }
}

// ฟังก์ชันจัดการตอนกดยืนยันสิทธิ์
function submitClaim() {
    const claimText = document.getElementById('claimInput').value;
    if(claimText.trim() === '') { 
        alert('กรุณาระบุข้อมูลหรือตำหนิลับเฉพาะเพื่อยืนยันตัวตน'); 
        return; 
    }

    if (currentClaimId) {
        let savedPosts = JSON.parse(localStorage.getItem('lf_posts')) || [];
        let postIndex = savedPosts.findIndex(post => post.dateStr === currentClaimId);
        let postToClaim;

        // ตรวจสอบว่าเป็นการ์ดตัวอย่างที่มากับ HTML หรือโพสต์ในระบบ
        if (postIndex === -1) {
            postToClaim = {
                name: document.getElementById('modalTitle').innerText,
                location: document.getElementById('modalLocation').innerText,
                timeRaw: document.getElementById('modalTime').innerText,
                imageUrl: document.getElementById('modalImage').src,
                dateStr: currentClaimId
            };
        } else {
            postToClaim = savedPosts[postIndex];
            // อัปเดตสถานะใน Local Storage เพื่อไม่ให้กลับไปเป็นแบบเดิมตอนรีเฟรช
            savedPosts[postIndex].claimStatus = 'pending';
            localStorage.setItem('lf_posts', JSON.stringify(savedPosts));
        }

        // สร้าง Object บันทึกคำขอ
        const newClaimRequest = {
            ...postToClaim,
            claimNote: claimText,
            claimDate: new Date().toISOString(),
            status: 'pending'
        };

        let allClaims = JSON.parse(localStorage.getItem('lf_claims')) || [];
        allClaims.push(newClaimRequest);
        localStorage.setItem('lf_claims', JSON.stringify(allClaims));

        // อัปเดตการแสดงผลบนหน้าจอการ์ดปัจจุบัน (ไม่ลบทิ้ง)
        const cards = document.querySelectorAll('.feed-grid .card');
        cards.forEach(card => {
            if (card.getAttribute('data-date') === currentClaimId) {
                // เปลี่ยนข้อความสถานะในการ์ด
                const paragraphs = card.querySelectorAll('p');
                paragraphs.forEach(p => {
                    if (p.innerText.includes('📌 สถานะ:')) {
                        p.innerText = '📌 สถานะ: กำลังดำเนินการ';
                    }
                });

                // เปลี่ยนปุ่ม "ขอรับคืน" เป็นปุ่มสีเทาและกดซ้ำไม่ได้
                const claimBtn = card.querySelector('.btn-claim');
                if (claimBtn) {
                    claimBtn.innerText = 'กำลังดำเนินการ';
                    claimBtn.style.background = '#555';
                    claimBtn.style.cursor = 'not-allowed';
                    claimBtn.disabled = true;
                    claimBtn.removeAttribute('onclick');
                }
            }
        });
    }

    // ปิดหน้า Modal แจ้งรายละเอียด และโชว์ Modal ขอบคุณ
    document.getElementById('itemModal').style.display = 'none';
    document.getElementById('claimInput').value = '';
    document.getElementById('successModal').style.display = 'block';
    
    currentClaimId = null;
}

document.getElementById('report-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const typeValue = document.getElementById('input-type').value;
    const categorySelect = document.getElementById('input-category');
    const categoryValue = categorySelect.value;
    const categoryText = categorySelect.options[categorySelect.selectedIndex].text;
    
    const name = document.getElementById('input-name').value;
    let timeRaw = document.getElementById('input-time').value; 
    const location = document.getElementById('input-location').value;
    const desc = document.getElementById('input-desc').value.replace(/'/g, "\\'");
    
    const imageInput = document.getElementById('input-image');
    let imageUrl = '';
    
    if(!timeRaw) {
        const now = new Date();
        timeRaw = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }

    if (imageInput.files && imageInput.files[0]) {
        imageUrl = await compressImage(imageInput.files[0]);
    }

    const dateObj = new Date(timeRaw.replace(/-/g, '/')); 
    const isoDateString = dateObj.toISOString(); 

    const postData = {
        typeValue, categoryValue, categoryText, name, timeRaw, location, desc, imageUrl, dateStr: isoDateString
    };

    try {
        let savedPosts = JSON.parse(localStorage.getItem('lf_posts')) || [];
        savedPosts.push(postData);
        localStorage.setItem('lf_posts', JSON.stringify(savedPosts));
    } catch (error) {
        alert('เกิดข้อผิดพลาด: พื้นที่จัดเก็บในเบราว์เซอร์ของคุณเต็ม ไม่สามารถบันทึกรูปภาพได้');
        console.error(error);
        return;
    }

    const newCard = createCardElement(postData);
    const feedGrid = document.getElementById('feed-grid');
    feedGrid.insertBefore(newCard, feedGrid.firstChild);

    this.reset();
    document.querySelector("#input-time")._flatpickr.setDate(new Date());
    const fileNameDisplay = document.getElementById('file-name-display');
    fileNameDisplay.textContent = 'คลิกเพื่ออัปโหลดรูปภาพ';
    fileNameDisplay.classList.remove('file-name-active');
    
    filterCategory('all');
    alert('โพสต์แจ้งข้อมูลสำเร็จ!');
    document.querySelector('.search-section').scrollIntoView({ behavior: 'smooth' });
});