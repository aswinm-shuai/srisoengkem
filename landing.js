// Format currency
const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};

// Global State
let cart = {};
let productsData = [];

// Wait for Firebase to initialize
let isFirebaseReady = false;
const checkFirebase = setInterval(() => {
  if (window.db) {
    clearInterval(checkFirebase);
    isFirebaseReady = true;
    initLandingPage();
  }
}, 500);

function initLandingPage() {
  // Mobile Menu Toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  
  if(mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '70px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = 'rgba(255, 255, 255, 0.95)';
      navLinks.style.padding = '20px';
      navLinks.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
    });
  }

  // Listen to Settings from Syncro OS via Firestore
  window.fbOnSnapshot(window.fbDoc(window.db, 'settings', 'store'), (doc) => {
    if (doc.exists()) {
      const settings = doc.data();
      
      // Update Title & Brand Name
      document.title = `${settings.bizName} - ${settings.tagline}`;
      const navLogo = document.querySelector('.nav-logo');
      if (navLogo) {
        navLogo.innerHTML = `<img src="https://ui-avatars.com/api/?name=${settings.bizName.substring(0,2).toUpperCase()}&background=0F6A4A&color=fff&rounded=true" alt="Logo">\n      ${settings.bizName}`;
      }
      
      const footerBrandName = document.querySelector('.footer-brand h3');
      if (footerBrandName) footerBrandName.textContent = settings.bizName;

      // Update Hero
      const heroBadge = document.querySelector('.hero-content .badge');
      if (heroBadge) heroBadge.textContent = settings.tagline;
      
      const heroDesc = document.querySelector('.hero-content p');
      if (heroDesc) heroDesc.textContent = settings.bizDesc;

      // Update Footer Contacts
      const waLink = document.querySelector('.footer-links .fa-phone');
      if (waLink && waLink.parentNode) {
        waLink.parentNode.innerHTML = `<i class="fas fa-phone" style="color:var(--gold);margin-right:8px"></i> +${settings.waNumber}`;
      }

      const addrLink = document.querySelector('.footer-links .fa-map-marker-alt');
      if (addrLink && addrLink.parentNode) {
        addrLink.parentNode.innerHTML = `<i class="fas fa-map-marker-alt" style="color:var(--gold);margin-right:8px"></i> ${settings.address}`;
      }

      const footerDesc = document.querySelector('.footer-brand p');
      if (footerDesc) footerDesc.textContent = `${settings.tagline}. ${settings.bizDesc}`;

      // Update Global WhatsApp for Checkout
      window.storeWaNumber = settings.waNumber;
    }
  });

  // Listen to Products in Realtime from Syncro OS via Firestore
  window.fbOnSnapshot(window.fbCollection(window.db, 'products'), (snapshot) => {
    const container = document.getElementById('menu-container');
    if(!container) return;

    container.innerHTML = ''; // Clear loading

    productsData = [];
    snapshot.forEach(doc => {
      productsData.push(doc.data());
    });

    // Filter only available foods
    const availableProducts = productsData.filter(p => p.available === true);

    if (availableProducts.length === 0) {
      container.innerHTML = '<p style="text-align:center; grid-column:1/-1; color: var(--text-muted);">Belum ada menu yang tersedia saat ini.</p>';
      return;
    }

    availableProducts.forEach(product => {
      // Use product.imageUrl (from Syncro OS / Cloudinary) or emoji fallback
      const hasImage = !!product.imageUrl;
      const mediaHtml = hasImage 
        ? `<img src="${product.imageUrl}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:64px;background:#f5f5f5;">${product.emoji || '🍽️'}</div>`;
      
      // Check Stock from Syncro OS Recipes/Ingredients if provided, or assume available if not explicitly tracked
      // Syncro OS uses `recipe` and `ingredients.stock` to calculate real stock, 
      // but without real-time backend calculations, we will rely on Syncro OS setting `available: false` when out of stock.
      // However, if the product explicitly has a stock property, we check it.
      let outOfStock = false;
      if (product.stock !== undefined && product.stock <= 0) {
        outOfStock = true;
      }

      const card = document.createElement('div');
      card.className = 'menu-card';
      card.innerHTML = `
        <div class="menu-img" style="height:200px;overflow:hidden;">
          ${mediaHtml}
        </div>
        <div class="menu-info">
          <h3 class="menu-name">${product.name}</h3>
          <p class="menu-desc">${product.desc || 'Sajian lezat dengan cita rasa otentik.'}</p>
          <div class="menu-footer">
            <div class="menu-price">${formatRupiah(product.price || 0)}</div>
            ${outOfStock 
              ? `<span style="color:var(--danger);font-weight:600;font-size:13px;">Stok Habis</span>`
              : `<button class="btn-add" data-id="${product.id}" title="Tambah ke Keranjang"><i class="fas fa-plus"></i></button>`
            }
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Attach Add to Cart Listeners
    document.querySelectorAll('.btn-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const prod = availableProducts.find(p => p.id === id);
        if (prod) addToCart(prod);
      });
    });
  });

  // Cart Logic
  const cartBubble = document.getElementById('cart-bubble');
  const cartCount = document.getElementById('cart-count');

  function addToCart(product) {
    if (!cart[product.id]) {
      cart[product.id] = { ...product, qty: 1 };
    } else {
      cart[product.id].qty++;
    }
    updateCartUI();
  }

  function updateCartUI() {
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
    if (totalItems > 0) {
      cartBubble.style.display = 'flex';
      cartCount.textContent = totalItems;
    } else {
      cartBubble.style.display = 'none';
    }
  }

  // Redirect to WhatsApp logic & Sync to Firestore
  cartBubble.addEventListener('click', async () => {
    if (Object.keys(cart).length === 0) return;
    
    // Prompt for customer details (Simplified for this integration)
    const custName = prompt("Masukkan Nama Anda:") || "Pelanggan Online";
    let waNumber = prompt("Masukkan Nomor WhatsApp Anda (contoh: 0812...):") || "";
    const address = prompt("Masukkan Alamat Pengiriman:") || "";
    const mapsLink = prompt("Masukkan Share Lokasi (Google Maps) (Opsional):") || "";
    
    if(!waNumber) {
      alert("Pesanan dibatalkan: Nomor WhatsApp wajib diisi.");
      return;
    }

    let total = 0;
    const itemsForDB = [];
    let text = `Halo *Sri Soengkem*, saya ingin memesan:\n\n`;
    
    Object.values(cart).forEach(item => {
      const subtotal = item.qty * item.price;
      total += subtotal;
      itemsForDB.push({ productId: item.id, qty: item.qty, price: item.price });
      text += `- ${item.qty}x ${item.name} (${formatRupiah(subtotal)})\n`;
    });
    
    text += `\n*Total: ${formatRupiah(total)}*`;
    text += `\nNama: ${custName}\nAlamat: ${address}\n`;
    if (mapsLink) text += `Maps: ${mapsLink}\n`;
    text += `\nMohon diproses. Terima kasih.`;

    try {
      // 1. Write Order to Firestore
      const orderId = 'o' + Date.now();
      const newOrder = {
        id: orderId,
        date: new Date().toISOString(),
        customerName: custName,
        wa: waNumber,
        address: address,
        mapsLink: mapsLink,
        items: itemsForDB,
        total: total,
        payment: 'transfer',
        status: 'pending',
        paymentStatus: 'menunggu'
      };
      
      await window.fbSetDoc(window.fbDoc(window.db, 'orders', orderId), newOrder);

      // 2. Sync Customer Data
      const custId = 'c_' + waNumber.replace(/\D/g, '');
      // Try to get customer, if not exist, create. Since we don't have getDoc imported easily, we can just use setDoc with merge:true
      await window.fbSetDoc(window.fbDoc(window.db, 'customers', custId), {
        id: custId,
        name: custName,
        wa: waNumber,
        address: address
        // totalOrders & totalSpent will be updated by Admin Dashboard later if needed, or we just merge.
      }, { merge: true });

      // 3. Clear cart and notify
      cart = {};
      updateCartUI();
      
      alert("Pesanan Anda telah berhasil dikirim ke restoran!");

      // 4. Open WhatsApp
      const adminWa = window.storeWaNumber || '6281234567890'; // Use synced WA
      const url = `https://wa.me/${adminWa}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      
    } catch(err) {
      console.error("Gagal mengirim pesanan:", err);
      alert("Terjadi kesalahan saat memproses pesanan Anda. Silakan coba lagi.");
    }
  });
}
