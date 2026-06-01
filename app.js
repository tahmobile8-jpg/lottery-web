import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, setPersistence,
    browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, collection, doc, setDoc, deleteDoc,
    onSnapshot, query, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAUDL7NfzCUY8B8ffWJKYE11EAWztmqmxE",
    authDomain: "tahkmn-68fbd.firebaseapp.com",
    projectId: "tahkmn-68fbd",
    storageBucket: "tahkmn-68fbd.firebasestorage.app",
    messagingSenderId: "337572833345",
    appId: "1:337572833345:web:47d48b094e62fa43cb7ec0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── Global State ───────────────────────────────────────────────
let currentUser = null;
let bills = [];
let currentWinnersList = [];
let billsUnsubscribe = null;
let dailyUnsubscribe = null;
const roomNames = {
    room1: "ຫ້ອງທີ 1 90/650",
    room2: "ຫ້ອງທີ 2 80/600",
    room3: "ຫ້ອງທີ 3 70/500"
};

// ─── Event Listeners ────────────────────────────────────────────
document.getElementById('btnAuthSubmit').addEventListener('click', handleAuth);
document.getElementById('btnLogout').addEventListener('click', handleLogout);
document.getElementById('btnSubmit').addEventListener('click', processBatchText);
document.getElementById('btnCancelEdit').addEventListener('click', cancelEdit);
document.getElementById('btnClearData').addEventListener('click', clearData);
document.getElementById('btnCopyAll').addEventListener('click', copyToClipboard);
document.getElementById('btnCopyWinners').addEventListener('click', copyWinnersToClipboard);
document.getElementById('winningNumberInput').addEventListener('input', searchWinners);
document.getElementById('billSearchInput').addEventListener('input', renderBillCards);
document.getElementById('modalConfirmBtn').addEventListener('click', executeConfirmedAction);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);

// ຜູກປຸ່ມກົດຕັດຍອດດ້ວຍຕົນເອງ
document.getElementById('btnManualCutoff').addEventListener('click', () => {
    if (confirm("ທ່ານຕ້ອງການກົດຕັດຍອດລວມຂອງມື້ນີ້ ແລະ ບັນທຶກລົງ 'ຫ້ອງສະຫຼຸບລວມລາຍວັນ' ດຽວນີ້ເລີຍແທ້ບໍ່?")) {
        triggerAutoCutoff(true);
    }
});

// ─── Auth ────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        document.getElementById('userWelcomeLabel').innerText = `👤 ບັນຊີ: ${user.email} (Online)`;
        listenToBillsData(user.uid);
        listenToDailySummary(user.uid);
    } else {
        currentUser = null;
        if (billsUnsubscribe) { billsUnsubscribe(); billsUnsubscribe = null; }
        if (dailyUnsubscribe) { dailyUnsubscribe(); dailyUnsubscribe = null; }
        bills = [];
        document.getElementById('appSection').classList.add('hidden');
        document.getElementById('authSection').classList.remove('hidden');
    }
});

async function handleAuth() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const btn = document.getElementById('btnAuthSubmit');
    const rememberMe = document.getElementById('authRememberMe')?.checked ?? true;

    if (!email || !password) { showToast('ກະລຸນາກອກອີເມວ ແລະ ລະຫັດຜ່ານ', 'error'); return; }
    btn.innerText = "ກຳລັງກວດສອບ...";
    btn.disabled = true;

    try {
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showToast('❌ ' + translateError(error.code), 'error');
        btn.innerText = "🚀 ເຂົ້າສູ່ລະບົບ";
        btn.disabled = false;
    }
}

function handleLogout() {
    showModal('ອອກຈາກລະບົບ', 'ທ່ານຕ້ອງການອອກຈາກລະບົບແທ້ບໍ່?', () => signOut(auth));
}

function translateError(code) {
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'ລະຫັດຜ່ານ ຫຼື ບັນຊີບໍ່ຖືກຕ້ອງ';
    if (code === 'auth/user-not-found') return 'ບໍ່ພົບອີເມວນີ້ໃນລະບົບ';
    if (code === 'auth/too-many-requests') return 'ພະຍາຍາມຫຼາຍຄັ້ງ ກະລຸນາລໍຖ້າຄາວໜຶ່ງ';
    return code;
}

// ─── Modal ──────────────────────────────────────────────────────
let _pendingAction = null;

function showModal(title, message, onConfirm) {
    _pendingAction = onConfirm;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    document.getElementById('customModal').classList.remove('hidden');
}

function closeModal() {
    _pendingAction = null;
    document.getElementById('customModal').classList.add('hidden');
}

function executeConfirmedAction() {
    closeModal();
    if (_pendingAction) _pendingAction();
}

// ─── Toast Notification ─────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    toast.innerText = message;
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg font-medium text-sm transition-all duration-300 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}`;
    toast.classList.remove('opacity-0', 'translate-y-4');
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-4'); }, 3000);
}

// ─── Loading State ───────────────────────────────────────────────
function setLoading(isLoading) {
    const el = document.getElementById('loadingOverlay');
    if (isLoading) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

// ─── Firestore ───────────────────────────────────────────────────
function listenToBillsData(uid) {
    setLoading(true);
    const q = query(collection(db, "users", uid, "bills"));
    billsUnsubscribe = onSnapshot(q, (snapshot) => {
        bills = [];
        snapshot.forEach((d) => { bills.push(d.data()); });
        renderBillCards();
        calculateSummary();
        searchWinners();
        setLoading(false);
    }, (error) => {
        console.error("Firestore error:", error);
        showToast('❌ ເຊື່ອມຕໍ່ Database ຜິດພາດ', 'error');
        setLoading(false);
    });
}

// ─── Parse & Save Bill ───────────────────────────────────────────
async function processBatchText() {
    if (!currentUser) return;

    // 1. ກວດສອບຂໍ້ມູນກ່ອນ (ປ້ອງກັນບັກປຸ່ມຄ້າງ)
    const rawText = document.getElementById('batchText').value.trim();
    if (!rawText) { showToast('ກະລຸນາວາງຂໍ້ຄວາມຍອດຫວຍກ່ອນ', 'error'); return; }

    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.innerText = "⏳ ກຳລັງບັນທຶກ...";

    try {
        let customerName = document.getElementById('batchCustomer').value.trim() || "ລູກຄ້າທົ່ວໄປ";
        let commRate = parseFloat(document.getElementById('customerCommission').value);
        const selectedRoom = document.getElementById('batchRoom').value;
        const editingId = document.getElementById('editingBillId').value;

        if (isNaN(commRate) || commRate < 0) commRate = 0;

        const today = new Date();
        const drawDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        let parsedItems = [];
        let billTotalAmount = 0;
        let unparsedLines = [];

        // --- (Logic ການ Parse ຂໍ້ຄວາມຄືເກົ່າຂອງທ່ານ) ---
        const lines = rawText.split('\n');
        lines.forEach(line => {
            let trimmedLine = line.trim();
            if (trimmedLine.length === 0) return;
            const splitRegex = /([0-9\s\x2a\-\,\;\.\+]+)([\=\:\;]|\bhu\b|\bHu\b|ຫູ|ฮู|ฮุู|ປ່ອງລະ|ປ່ອງ|ຕາລະ|ຕາ)\s*(\d+)/i;
            const match = trimmedLine.match(splitRegex);
            if (match) {
                const rawNumbersPart = match[1].trim();
                let moneyAmount = parseFloat(match[3]);
                if (moneyAmount < 5000) moneyAmount = moneyAmount * 1000;
                const lotteryList = rawNumbersPart.split(/[\s\x2a\-\,\;\.\+]+/);
                lotteryList.forEach(lotteryNum => {
                    let trimmedNum = lotteryNum.trim();
                    if (trimmedNum.length > 0 && !isNaN(trimmedNum)) {
                        let typeLabel = trimmedNum.length === 3 ? "3 ຕົວ" : "2 ຕົວ";
                        parsedItems.push({ number: trimmedNum, type: typeLabel, amount: moneyAmount });
                        billTotalAmount += moneyAmount;
                    }
                });
            } else { unparsedLines.push(trimmedLine); }
        });

        // ຖ້າແຍກບໍ່ໄດ້ເລີຍ ໃຫ້ໂຍນ Error ເພື່ອໃຫ້ຕົກໄປຂັ້ນຕອນ finally
        if (parsedItems.length === 0) {
            throw new Error('ບໍ່ສາມາດແຍກຂໍ້ມູນໄດ້ຈັກແຖວ!');
        }

        // ສະແດງຂໍ້ຄວາມເຕືອນ unparsed lines
        const logContainer = document.getElementById('validationLogContainer');
        const logList = document.getElementById('validationLogList');
        if (unparsedLines.length > 0) {
            logList.innerHTML = unparsedLines.map(l => `<li>${l}</li>`).join('');
            logContainer.classList.remove('hidden');
        } else { logContainer.classList.add('hidden'); }

        let targetId = editingId ? editingId : "bill_" + Date.now();
        let finalItems = parsedItems;
        let finalRawText = rawText;

        // ✅ FIX BUG 2: ແຍກ Logic ລະຫວ່າງ "ສ້າງໃໝ່/ລວມບິນ" ກັບ "ໂໝດແກ້ໄຂ" ໃຫ້ເດັດຂາດ
        if (!editingId) {
            const existing = bills.find(b =>
                b.customer.toLowerCase() === customerName.toLowerCase() &&
                b.room === selectedRoom &&
                b.drawDate === drawDate
            );
            if (existing) {
                targetId = existing.id;
                finalItems = [...existing.items, ...parsedItems];
                billTotalAmount += existing.totalAmount; // ລວມຍອດເກົ່າໃສ່ ຖ້າເປັນບິນຊ້ຳໃນໂໝດສ້າງໃໝ່
                finalRawText = existing.rawText + "\n" + rawText;
            }
        }

        // ຄິດໄລ່ກຳໄລຈາກຍອດລວມທີ່ຖືກຕ້ອງສອງກໍລະນີ
        let billProfit = billTotalAmount * (commRate / 100);

        await setDoc(doc(db, "users", currentUser.uid, "bills", targetId), {
            id: targetId,
            customer: customerName,
            pct: commRate,
            room: selectedRoom,
            rawText: finalRawText,
            items: finalItems,
            totalAmount: billTotalAmount,
            profit: billProfit,
            drawDate: drawDate,
            createdAt: editingId ? (bills.find(b => b.id === editingId)?.createdAt || Date.now()) : Date.now()
        });

        if (editingId) cancelEdit();
        if (unparsedLines.length === 0) {
            document.getElementById('batchText').value = '';
        }
        showToast(`✅ ບັນທຶກໃບບິນ [${customerName}] ສຳເລັດ!`);

    } catch (error) {
        console.error("Error saving bill:", error);
        showToast("❌ " + error.message, 'error');
    } finally {
        // ປຸ່ມຈະຖືກປົດລັອກສະເໝີ ບໍ່ວ່າຈະເຮັດວຽກສຳເລັດ ຫຼື ຜິດພາດ
        btnSubmit.disabled = false;
        btnSubmit.innerText = document.getElementById('editingBillId').value
            ? "💾 ບັນທຶກການແກ້ໄຂບິນ"
            : "⚡ ບັນທຶກລົງ Cloud Database";
    }
}

async function deleteBill(id) {
    if (!currentUser) return;
    showModal('ລຶບໃບບິນ', 'ທ່ານຕ້ອງການລຶບໃບບິນນີ້ອອກຈາກ Cloud ແທ້ບໍ່?', async () => {
        await deleteDoc(doc(db, "users", currentUser.uid, "bills", id));
        showToast('🗑️ ລຶບໃບບິນແລ້ວ');
    });
}

async function clearData() {
    if (!currentUser) return;
    showModal(
        '🚨 ລ້າງຂໍ້ມູນທັງໝົດ',
        'ທ່ານແນ່ໃຈບໍ່? การລ້າງຂໍ້ມູນຈະລຶບທຸກໃບບິນໃນ Cloud ຖາວອນ ເພື່ອຂຶ້ນງວດໃໝ່',
        async () => {
            const batch = writeBatch(db);
            bills.forEach(b => { batch.delete(doc(db, "users", currentUser.uid, "bills", b.id)); });
            await batch.commit();
            document.getElementById('winningNumberInput').value = '';
            cancelEdit();
            showToast('🧹 ລ້າງຂໍ້ມູນຂຶ້ນງວດໃໝ່ແລ້ວ!');
        }
    );
}

// ─── UI Render ───────────────────────────────────────────────────
function renderBillCards() {
    const container = document.getElementById('billCardsContainer');
    const searchVal = (document.getElementById('billSearchInput')?.value || '').trim().toLowerCase();
    const filtered = searchVal
        ? bills.filter(b => b.customer.toLowerCase().includes(searchVal))
        : bills;

    container.innerHTML = '';
    document.getElementById('ticketCount').innerText = `🧾 ໃບບິນຫວຍທັງໝົດ (ລວມ: ${bills.length} ບິນ${searchVal ? `, ສະແດງ: ${filtered.length}` : ''})`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full py-12 text-center text-gray-400 font-medium">${searchVal ? '🔍 ບໍ່ພົບລູກຄ້າທີ່ຊອກຫາ' : '✨ ບໍ່ທັນມີຂໍ້ມູນໃບບິນຫວຍ.'}</div>`;
        return;
    }

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    filtered.forEach((bill) => {
        const createdAt = bill.createdAt || now;
        const expiryTime = createdAt + SEVEN_DAYS_MS;
        const timeLeft = expiryTime - now;

        if (timeLeft <= 0) {
            deleteDoc(doc(db, "users", currentUser.uid, "bills", bill.id));
            return;
        }

        const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        let countdownText = `⏳ ລຶບອັດຕະໂນມັດ: ອີກ ${daysLeft} ມື້ ${hoursLeft} ຊົ່ວໂມງ`;
        if (daysLeft === 0) countdownText = `⚠️ ຈະລຶບໃນ: ${hoursLeft} ຊົ່ວໂມງ ${minsLeft} นາທີ`;

        let netAmount = bill.totalAmount - bill.profit;
        const card = document.createElement('div');
        card.className = "bg-white rounded-xl shadow-lg p-4 border border-gray-200 flex flex-col justify-between relative overflow-hidden";

        let itemsHtml = bill.items.map(it => `
            <div class="flex justify-between items-center text-xs bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                <span class="font-bold text-gray-800">${it.number}</span>
                <span class="text-[10px] px-1 bg-indigo-50 text-indigo-600 rounded">${it.type === '3 ຕົວ' ? '3T' : '2T'}</span>
                <span class="text-gray-600">${it.amount.toLocaleString()}</span>
            </div>
        `).join('');

        // 🔴 ປ່ຽນຍອດສົ່ງສຸດທິໃນບິນໃຫ້ເປັນຄ່າຕິດລົບ (-) ແລະ ສີແດງ (text-red-600)
        card.innerHTML = `
            <div>
                <div class="mb-3 p-2 bg-slate-900 text-white rounded-lg flex flex-col gap-1">
                    <div class="flex justify-between text-xs font-bold">
                        <span>📅 ງວດ: ${bill.drawDate || 'ບໍ່ລະບຸ'}</span>
                        <span class="text-amber-400">ປະຫວັດ</span>
                    </div>
                    <div class="text-[10px] text-amber-300 font-mono border-t border-slate-700 pt-1">${countdownText}</div>
                </div>
                <div class="flex justify-between items-start border-b pb-2 mb-3">
                    <div>
                        <h4 class="font-bold text-base text-gray-900">👤 ${bill.customer}</h4>
                        <span class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">${roomNames[bill.room]}</span>
                    </div>
                    <span class="text-xs font-bold text-pink-600 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-md">ເປີ: ${bill.pct}%</span>
                </div>
                <div class="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                    <div class="grid grid-cols-2 gap-1.5">${itemsHtml}</div>
                </div>
            </div>
            <div class="mt-4 border-t border-dashed pt-3 space-y-1.5 bg-slate-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                <div class="flex justify-between text-xs text-gray-500"><span>ຍອດລວມຊື້:</span><span class="font-bold text-gray-900">${bill.totalAmount.toLocaleString()}</span></div>
                <div class="flex justify-between text-xs text-green-600"><span>ຫັກເປີເຊັນ:</span><span class="font-bold">+${bill.profit.toLocaleString()}</span></div>
                <div class="flex justify-between text-sm font-bold text-red-600 border-t pt-1.5"><span>💵 ຍອດສົ່ງສຸດທິ:</span><span>-${netAmount.toLocaleString()} ກີບ</span></div>
                <div class="grid grid-cols-3 gap-1 pt-3 border-t mt-2">
                    <button class="btn-copy bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-1 rounded transition" data-id="${bill.id}">📋 ກັອບປີ້</button>
                    <button class="btn-edit bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold py-1.5 px-1 rounded transition" data-id="${bill.id}">✏️ ແກ້ໄຂ</button>
                    <button class="btn-delete bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold py-1.5 px-1 rounded transition" data-id="${bill.id}">🗑️ ລຶບ</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.btn-copy').forEach(b => b.addEventListener('click', (e) => copySingleBill(e.currentTarget.dataset.id)));
    container.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', (e) => editBill(e.currentTarget.dataset.id)));
    container.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', (e) => deleteBill(e.currentTarget.dataset.id)));
}

function calculateSummary() {
    let totalSalesAll = 0, totalProfitAll = 0;
    let roomSummary = {
        room1: { sales: 0, profit: 0 },
        room2: { sales: 0, profit: 0 },
        room3: { sales: 0, profit: 0 }
    };

    bills.forEach(bill => {
        totalSalesAll += bill.totalAmount;
        totalProfitAll += bill.profit;
        if (roomSummary[bill.room]) {
            roomSummary[bill.room].sales += bill.totalAmount;
            roomSummary[bill.room].profit += bill.profit;
        }
    });

    // 🔴 ປ່ຽນຍອດໂອນສົ່ງໃນກາດສະຫຼຸບໃຫ້ຕິດລົບ (-) 
    document.getElementById('totalSalesAll').innerText = totalSalesAll.toLocaleString() + " ກີບ";
    document.getElementById('totalProfitAll').innerText = totalProfitAll.toLocaleString() + " ກີບ";
    document.getElementById('totalNetAll').innerText = "-" + (totalSalesAll - totalProfitAll).toLocaleString() + " ກີບ";

    // 🔴 ປ່ຽນຍອດໂອນສົ່ງແຍກຫ້ອງໃຫ້ຕິດລົບ (-)
    ['room1', 'room2', 'room3'].forEach(r => {
        document.getElementById(`${r}Sales`).innerText = roomSummary[r].sales.toLocaleString() + " ກີບ";
        document.getElementById(`${r}Profit`).innerText = roomSummary[r].profit.toLocaleString() + " ກີບ";
        document.getElementById(`${r}Net`).innerText = "-" + (roomSummary[r].sales - roomSummary[r].profit).toLocaleString() + " ກີບ";
    });
}

// ─── Edit / Cancel ───────────────────────────────────────────────
function editBill(id) {
    const bill = bills.find(b => b.id == id);
    if (!bill) return;
    document.getElementById('editingBillId').value = bill.id;
    document.getElementById('batchCustomer').value = bill.customer;
    document.getElementById('customerCommission').value = bill.pct;
    document.getElementById('batchRoom').value = bill.room;
    document.getElementById('batchText').value = bill.rawText;
    document.getElementById('formTitle').innerText = "✏️ ກຳລັງແກ້ໄຂໃບບິນ";
    document.getElementById('btnSubmit').innerText = "💾 ບັນທຶກການແກ້ໄຂບິນ";
    document.getElementById('btnCancelEdit').classList.remove('hidden');
    document.getElementById('editModeBadge').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('editingBillId').value = "";
    document.getElementById('batchCustomer').value = "";
    document.getElementById('batchText').value = "";
    document.getElementById('formTitle').innerText = "📝 ຄີຂໍ້ມູນຫວຍ";
    document.getElementById('btnSubmit').innerText = "⚡ ບັນທຶກລົງ Cloud Database";
    document.getElementById('btnCancelEdit').classList.add('hidden');
    document.getElementById('editModeBadge').classList.add('hidden');
    document.getElementById('validationLogContainer').classList.add('hidden');
}

// ─── Search Winners ──────────────────────────────────────────────
function searchWinners() {
    const winNum = document.getElementById('winningNumberInput').value.trim();
    const tbody = document.getElementById('winnerTableBody');

    if (!winNum) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 bg-amber-50/50">ກະລຸນາກອກເລກລາງວັນເພື່ອຄົ້ນຫາ</td></tr>`;
        document.getElementById('winnerCountLabel').innerText = "0 ລາຍການ";
        document.getElementById('winnerTotalPayoutLabel').innerText = "0 ກີບ";
        currentWinnersList = [];
        return;
    }

    currentWinnersList = [];
    let totalPayout = 0;
    let winNum2Digits = winNum.length === 3 ? winNum.substring(1) : "";

    bills.forEach(bill => {
        bill.items.forEach(item => {
            let isWin = false;
            let currentRate = 0;

            if (item.number === winNum) {
                isWin = true;
                if (bill.room === "room1") currentRate = item.type === "3 ຕົວ" ? 650 : 90;
                else if (bill.room === "room2") currentRate = item.type === "3 ຕົວ" ? 600 : 80;
                else if (bill.room === "room3") currentRate = item.type === "3 ຕົວ" ? 500 : 70;
            } else if (winNum2Digits && item.number === winNum2Digits && item.type === "2 ຕົວ") {
                isWin = true;
                if (bill.room === "room1") currentRate = 90;
                else if (bill.room === "room2") currentRate = 80;
                else if (bill.room === "room3") currentRate = 70;
            }

            if (isWin) {
                let payout = item.amount * currentRate;
                totalPayout += payout;
                currentWinnersList.push({
                    customer: bill.customer,
                    number: item.number,
                    type: item.type,
                    room: bill.room,
                    payoutAmount: payout
                });
            }
        });
    });

    tbody.innerHTML = '';
    if (currentWinnersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500 font-medium bg-white">❌ ງວດນີ້ບໍ່ມີໃຜຖືກເລກ ${winNum}${winNum2Digits ? ' ຫຼື ' + winNum2Digits : ''}</td></tr>`;
        document.getElementById('winnerCountLabel').innerText = "0 ລາຍการ";
        document.getElementById('winnerTotalPayoutLabel').innerText = "0 ກີບ";
        return;
    }

    currentWinnersList.forEach(w => {
        const tr = document.createElement('tr');
        tr.className = "bg-white text-gray-700 border-b border-slate-100 hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="p-3 font-bold text-gray-900">${w.customer}</td>
            <td class="p-3 text-indigo-600 font-bold text-base">${w.number}</td>
            <td class="p-3">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${w.type === '3 ຕົວ' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                    ${w.type}
                </span>
            </td>
            <td class="p-3 text-xs text-gray-500">${roomNames[w.room]}</td>
            <td class="p-3 font-bold text-emerald-600 text-right">+${w.payoutAmount.toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('winnerCountLabel').innerText = `${currentWinnersList.length} ລາຍການ`;
    document.getElementById('winnerTotalPayoutLabel').innerText = totalPayout.toLocaleString() + " ກີບ";
}

// ─── Copy Functions ──────────────────────────────────────────────
function copySingleBill(id) {
    const bill = bills.find(b => b.id == id);
    if (!bill) return;
    let text = `🧾 ໃບບິນຫວຍສະຫຼຸບ | 👤 ລູກຄ້າ: ${bill.customer}\n📍 ຫ້ອງ: ${roomNames[bill.room]}\n-------------------------\n`;
    bill.items.forEach((item, i) => {
        text += `${i + 1}. [${item.type}] ${item.number} = ${item.amount.toLocaleString()} ກີບ\n`;
    });
    // 🔴 ປ່ຽນໃນຂໍ້ຄວາມກັອບປີ້ໃຫ້ຕິດລົບ (-) ເຊັ່ນກັນ
    text += `-------------------------\n💰 ຍອດລວມຊື້: ${bill.totalAmount.toLocaleString()} ກີບ\n✨ ເປີເຊັນຫັກໄດ້: +${bill.profit.toLocaleString()} ກີບ\n💵 ຍອດສຸດທິທີ່ຕ້ອງສົ່ງ: -${(bill.totalAmount - bill.profit).toLocaleString()} ກີບ\n\n🙏 ຂອບໃຈຄັບ!`;
    navigator.clipboard.writeText(text).then(() => showToast(`📋 ກັອບປີ້ໃບບິນ [${bill.customer}] ແລ້ວ!`));
}

function copyToClipboard() {
    if (!bills || bills.length === 0) { showToast('ບໍ່ມີຂໍ້ມູນໃບບິນ', 'error'); return; }
    let textOutput = "📌 ຍອດສະຫຼຸບສົ່ງຫວຍ (Cloud Database)\n=========================\n";
    let grandTotalSales = 0, grandTotalNet = 0;
    bills.forEach((bill) => {
        let net = bill.totalAmount - bill.profit;
        grandTotalSales += bill.totalAmount;
        grandTotalNet += net;
        textOutput += `\n👤 ຜູ້ສົ່ງ: ${bill.customer} (${roomNames[bill.room]})\n-------------------------\n`;
        bill.items.forEach((item, i) => {
            textOutput += `   ${i + 1}. ${item.number} = ${item.amount.toLocaleString()} ກີບ\n`;
        });
        textOutput += `   ➔ ຍອດລວມ: ${bill.totalAmount.toLocaleString()} | ຫັກ: +${bill.profit.toLocaleString()} | ສຸດທິ: -${net.toLocaleString()} ກີບ\n`;
    });
    textOutput += `\n=========================\n💰 ຍອດຂາຍລວມ: ${grandTotalSales.toLocaleString()} ກີບ\n💵 ຍອດໂອນສົ່ງເຈົ້າມື: -${grandTotalNet.toLocaleString()} ກີບ`;
    navigator.clipboard.writeText(textOutput).then(() => showToast('📋 ກັອບປີ້ຍອດສະຫຼຸບທຸກຫ້ອງແລ້ວ!'));
}

function copyWinnersToClipboard() {
    const winNum = document.getElementById('winningNumberInput').value.trim();
    if (!winNum || currentWinnersList.length === 0) { showToast('ບໍ່ມີລາຍຊື່ຄົນຖືກເລກ', 'error'); return; }
    let textOutput = `🎉 ລາຍຊື່ຜູ້ຖືກເລກ [ ${winNum} ]\n-------------------------\n`;
    currentWinnersList.forEach((w, index) => {
        textOutput += `${index + 1}. ລູກຄ້າ: ${w.customer} ➔ ເລກ: ${w.number}, ໄດ້ຮັບ: +${w.payoutAmount.toLocaleString()} ກີບ\n`;
    });
    let totalPayout = currentWinnersList.reduce((sum, t) => sum + t.payoutAmount, 0);
    textOutput += `-------------------------\n💵 ລວມຍອດເງິນລາງວັນ: ${totalPayout.toLocaleString()} ກີບ`;
    navigator.clipboard.writeText(textOutput).then(() => showToast('📋 ກັອບປີ້ລາຍຊື່ຄົນຖືກເລກແລ້ວ!'));
}

// ─── 📅 ລະບົບຫ້ອງສະຫຼຸບລວມລາຍວັນ (Auto 8 PM & Manual Cutoff) ───

// 1. ລະບົບກວດສອບເວລາຕັດຍອດອັດຕະໂນມັດ 8:00 PM
function startAutoCutoffTimer() {
    let hasTriggeredToday = false;
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 20 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            if (!hasTriggeredToday) {
                triggerAutoCutoff(false);
                hasTriggeredToday = true;
            }
        }
        if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
            hasTriggeredToday = false;
        }
    }, 1000);
}

// 2. ຟັງຊັນປະມວນຜົນຕັດຍອດ ແລະ ບັນທຶກລົງ Cloud Firestore
async function triggerAutoCutoff(isManual = false) {
    if (!bills || bills.length === 0) {
        if (isManual) alert("❌ ບໍ່ສາມາດຕັດຍອດໄດ້: ບໍ່ມີຂໍ້ມູນໃບບິນໃນລະບົບ.");
        return;
    }

    let totalSales = 0;
    let totalProfit = 0;
    const today = new Date();
    const drawDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    bills.forEach(bill => {
        totalSales += bill.totalAmount;
        totalProfit += bill.profit;
    });
    let totalNet = totalSales - totalProfit;

    if (totalSales === 0) {
        if (isManual) alert("❌ ບໍ່ສາມາດຕັດຍອດໄດ້: ຍອດລວມທັງໝົດໃນປັດຈຸບັນຄື 0 ກີບ.");
        return;
    }

    try {
        await setDoc(doc(db, "users", currentUser.uid, "daily_summaries", drawDate), {
            date: drawDate,
            totalSales: totalSales,
            totalProfit: totalProfit,
            totalNet: totalNet,
            timestamp: Date.now()
        });

        if (isManual) {
            alert(`✅ ຕັດຍອດສຳເລັດ!\n\nລະບົບໄດ້ບັນທຶກຍອດລວມຂອງງວດວັນທີ [${drawDate}] ລົງໃນຫ້ອງສະຫຼຸບລາຍວັນໃຫ້ທ່ານຮຽບຮ້ອຍແລ້ວ.`);
        } else {
            console.log(`⏰ [Auto 8 PM] Saved summary for ${drawDate}`);
        }
    } catch (err) {
        console.error("Error saving summary: ", err);
        if (isManual) alert("❌ ຕິດບັນຫາ: ບໍ່ສາມາດບັນທຶກຂໍ້ມູນລົງ Cloud ໄດ້.");
    }
}

// 3. ຟັງຊັນດຶງຂໍ້ມູນຍອດລາຍວັນ Real-time
function listenToDailySummary(uid) {
    const q = query(collection(db, "users", uid, "daily_summaries"));
    dailyUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('dailySummaryTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        let dailyData = [];
        snapshot.forEach((doc) => { dailyData.push(doc.data()); });
        
        dailyData.sort((a, b) => b.timestamp - a.timestamp);

        if (dailyData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">✨ ບໍ່ທັນມີປະຫວັດຍອດສະຫຼຸບລາຍວັນ</td></tr>`;
            return;
        }

        dailyData.forEach((day) => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-100 hover:bg-slate-50 transition text-sm text-gray-700";
            
            // 🔴 ປ່ຽນຍອດສົ່ງສຸດທິໃນຕາຕະລາງໃຫ້ຕິດລົບ (-) ແລະ ສະແດງເປັນສີແດງ text-red-600 font-bold
            tr.innerHTML = `
                <td class="p-3 font-bold text-gray-900">📅 ງວດວັນທີ: ${day.date}</td>
                <td class="p-3 text-right font-mono">${day.totalSales.toLocaleString()} ກີບ</td>
                <td class="p-3 text-right font-mono text-green-600 font-bold">+${day.totalProfit.toLocaleString()} ກີບ</td>
                <td class="p-3 text-right font-mono font-bold text-red-600">-${day.totalNet.toLocaleString()} ກີບ</td>
                <td class="p-3 text-center">
                    <button class="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded transition btn-delete-summary" data-id="${day.date}">🗑️ ລຶບ</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-delete-summary').forEach(b => {
            b.addEventListener('click', (e) => deleteDailySummary(e.currentTarget.dataset.id));
        });
    });
}

// 4. ຟັງຊັນສຳລັບລຶບປະຫວັດຍອດລາຍວັນ
async function deleteDailySummary(dateId) {
    if (!currentUser) return;
    if (confirm(`ທ່ານຕ້ອງການລຶບຍອດສະຫຼຸບລາຍວັນຂອງວັນທີ [${dateId}] ແທ້ບໍ່?`)) {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "daily_summaries", dateId));
            showToast('🗑️ ລຶບປະຫວັດຍອດລາຍວັນແລ້ວ');
        } catch (err) {
            console.error("Error deleting summary: ", err);
        }
    }
}

// Start Timer ຕັ້ງແຕ່ເປີດແອັບ
startAutoCutoffTimer();