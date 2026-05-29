import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ⚠️ ປ່ຽນຄ່າດ້ານລຸ່ມນີ້ ໃຫ້ເປັນຄ່າທີ່ກັອບປີ້ມາຈາກ Firebase Console ຂອງທ່ານ
const firebaseConfig = {
    apiKey: "AIzaSyAUDL7NfzCUY8B8ffWJKYE11EAWztmqmxE",
    authDomain: "tahkmn-68fbd.firebaseapp.com",
    projectId: "tahkmn-68fbd",
    storageBucket: "tahkmn-68fbd.firebasestorage.app",
    messagingSenderId: "337572833345",
    appId: "1:337572833345:web:47d48b094e62fa43cb7ec0"
  };;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------
// ໃສ່ໂຄ໊ດ "ຈົດຈຳລະຫັດຜ່ານ" ໄວ້ບ່ອນນີ້ເລີຍຄຮັບ:
// ---------------------------------------------------------
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("ລະບົບຕັ້ງຄ່າໃຫ້ຈົດຈຳການ Login ໄວ້ແລ້ວ");
  })
  .catch((error) => {
    console.error("ຕັ້ງຄ່າຈົດຈຳບໍ່ໄດ້:", error);
  });
// ---------------------------------------------------------

// Global Variables
let currentUser = null;
let isSignUpMode = false;
let bills = [];
let currentWinnersList = [];
const roomNames = { room1: "ຫ້ອງທີ 1 90/650", room2: "ຫ້ອງທີ 2 80/600", room3: "ຫ້ອງທີ 3 70/500" };

// ----------------- 🎯 ເຊື່ອມປຸ່ມ HTML ກັບ JAVASCRIPT -----------------
document.getElementById('btnAuthSubmit').addEventListener('click', handleAuth);
document.getElementById('btnToggleMode').addEventListener('click', toggleAuthMode);
document.getElementById('btnLogout').addEventListener('click', handleLogout);
document.getElementById('btnSubmit').addEventListener('click', processBatchText);
document.getElementById('btnCancelEdit').addEventListener('click', cancelEdit);
document.getElementById('btnClearData').addEventListener('click', clearData);
document.getElementById('btnCopyAll').addEventListener('click', copyToClipboard);
document.getElementById('btnCopyWinners').addEventListener('click', copyWinnersToClipboard);
document.getElementById('winningNumberInput').addEventListener('input', searchWinners);

// ----------------- 🔐 ລະບົບ AUTH (Login/Logout) -----------------
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        document.getElementById('userWelcomeLabel').innerText = `👤 ບັນຊີ: ${user.email} (Online)`;
        listenToBillsData(user.uid);
    } else {
        currentUser = null;
        document.getElementById('appSection').classList.add('hidden');
        document.getElementById('authSection').classList.remove('hidden');
    }
});

async function handleAuth() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();
    const btn = document.getElementById('btnAuthSubmit');

    if(!email || !password) { alert('ກະລຸນາກອກອີເມວ ແລະ ລະຫັດຜ່ານ'); return; }
    btn.innerText = "ກຳລັງປະມວນຜົນ...";
    btn.disabled = true;

    try {
        if (isSignUpMode) {
            await createUserWithEmailAndPassword(auth, email, password);
            alert('🎉 ສະໝັກສະມາຊິກສຳເລັດ!');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        alert('❌ ຜິດພາດ: ' + translateError(error.code));
        btn.innerText = isSignUpMode ? "🚀 ສະໝັກສະມາຊິກ" : "🚀 ເົ້າສູ່ລະບົບ";
        btn.disabled = false;
    }
}

function handleLogout() {
    if(confirm('ທ່ານຕ້ອງການອອກຈາກລະບົບແທ້ບໍ່?')) { signOut(auth); }
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('authTitle').innerText = isSignUpMode ? "📝 ສະໝັກສະມາຊິກໃໝ່" : "🔐 ເົ້າສູ່ລະບົບຫວຍອອນລາຍ";
    document.getElementById('authSubtitle').innerText = isSignUpMode ? "ຕັ້ງອີເມວ ແລະ ລະຫັດຜ່ານເພື່ອສ້າງບັນຊີຂອງທ່ານ" : "ກະລຸນາປ້ອນ ບັນຊີ ແລະ ລະຫັດຜ່ານ ເພື່ອຈັດການຂໍ້ມູນ";
    document.getElementById('btnAuthSubmit').innerText = isSignUpMode ? "🚀 ສະໝັກສະມາຊິກ" : "🚀 ເຂົ້າສູ່ລະບົບ";
    document.getElementById('btnToggleMode').innerText = isSignUpMode ? "ມີບັນຊີແລ້ວ? ກົດເຂົ້າສູ່ລະບົບຢູ່ບ່ອນນີ້" : "ຍັງບໍ່ມີບັນຊີ? ກົດສະໝັກສະມາຊິກໃໝ່ທີ່ນີ້";
}

function translateError(code) {
    if(code === 'auth/wrong-password') return 'ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ';
    if(code === 'auth/user-not-found') return 'ບໍ່ພົບອີເມວນີ້ໃນລະບົບ';
    if(code === 'auth/email-already-in-use') return 'ອີເມວນີ້ຖືກໃຊ້ສະໝັກໄປແລ້ວ';
    if(code === 'auth/weak-password') return 'ລະຫັດຜ່ານຕ້ອງມີ 6 ຕົວຂຶ້ນໄປ';
    return code;
}

// ----------------- ☁️ ລະບົບ DATABASE (Firestore Real-time) -----------------
function listenToBillsData(uid) {
    const q = query(collection(db, "users", uid, "bills"));
    onSnapshot(q, (snapshot) => {
        bills = [];
        snapshot.forEach((doc) => { bills.push(doc.data()); });
        renderBillCards();
        calculateSummary();
        searchWinners();
    });
}

async function processBatchText() {
    if(!currentUser) return;
    const rawText = document.getElementById('batchText').value.trim();
    let customerName = document.getElementById('batchCustomer').value.trim();
    let commRate = parseFloat(document.getElementById('customerCommission').value);
    const selectedRoom = document.getElementById('batchRoom').value;
    const editingId = document.getElementById('editingBillId').value;
    
    if (!rawText) { alert('ກະລຸນາວາງຂໍ້ຄວາມຍອດຫວຍກ່ອນ'); return; }
    if (!customerName) customerName = "ລູກຄ້າທົ່ວໄປ";
    if (isNaN(commRate) || commRate < 0) commRate = 0;

    let parsedItems = [];
    let billTotalAmount = 0;
    const lines = rawText.split('\n');
    
    lines.forEach(line => {
        line = line.trim(); if (line.length === 0) return;
        const splitRegex = /([0-9\s\x2a\-\,\;\.\+]+)([\=\:\;]|\bhu\b|\bHu\b|ຫູ|ຮູ|ຮຸູ|ປ່ອງລະ|ປ່ອງ|ຕາລະ|ຕາ)\s*(\d+)/i;
        const match = line.match(splitRegex);

        if (match) {
            const rawNumbersPart = match[1].trim(); 
            let moneyAmount = parseFloat(match[3]); 
            if (moneyAmount < 5000) moneyAmount = moneyAmount * 1000; 

            const lotteryList = rawNumbersPart.split(/[\s\x2a\-\,\;\.\+]+/);
            lotteryList.forEach(lotteryNum => {
                let trimmedNum = lotteryNum.trim();
                if (trimmedNum.length > 0 && !isNaN(trimmedNum)) {
                    parsedItems.push({ number: trimmedNum, type: trimmedNum.length >= 3 ? "3 ຕົວ" : "2 ຕົວ", amount: moneyAmount });
                    billTotalAmount += moneyAmount;
                }
            });
        }
    });

    if (parsedItems.length === 0) { alert('❌ ບໍ່ສາມາດແຍກຂໍ້ມູນໄດ້. ກະລຸນາກວດສອບຮູບແບບຂໍ້ຄວາມ'); return; }

    let targetId = editingId ? editingId : "bill_" + Date.now();
    let finalItems = parsedItems;
    let finalRawText = rawText;

    if (!editingId) {
        const existing = bills.find(b => b.customer.toLowerCase() === customerName.toLowerCase() && b.room === selectedRoom);
        if(existing) {
            targetId = existing.id;
            finalItems = [...existing.items, ...parsedItems];
            billTotalAmount += existing.totalAmount;
            finalRawText = existing.rawText + "\n" + rawText;
        }
    }

    let billProfit = billTotalAmount * (commRate / 100);

    await setDoc(doc(db, "users", currentUser.uid, "bills", targetId), {
        id: targetId, customer: customerName, pct: commRate, room: selectedRoom,
        rawText: finalRawText, items: finalItems, totalAmount: billTotalAmount, profit: billProfit
    });

    if (editingId) cancelEdit();
    document.getElementById('batchText').value = '';
}

async function deleteBill(id) {
    if(!currentUser) return;
    if(confirm('ທ່ານຕ້ອງການລຶບໃບບິນນີ້ອອກຈາກ Cloud ແທ້ບໍ່?')) {
        await deleteDoc(doc(db, "users", currentUser.uid, "bills", id));
    }
}

async function clearData() {
    if(!currentUser) return;
    if(confirm('🚨 ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລ້າງຂໍ້ມູນທັງໝົດໃນ Cloud ເພື່ອຂຶ້ນງວດໃໝ່?')) {
        const batch = writeBatch(db);
        bills.forEach(b => { batch.delete(doc(db, "users", currentUser.uid, "bills", b.id)); });
        await batch.commit();
        document.getElementById('winningNumberInput').value = '';
        cancelEdit();
    }
}

// ----------------- 🎨 UI RENDER & CALCULATION -----------------
function renderBillCards() {
    const container = document.getElementById('billCardsContainer');
    container.innerHTML = '';
    document.getElementById('ticketCount').innerText = `🧾 ໃບບິນຫວຍງວດນີ້ (ລວມ: ${bills.length} ບຸກຄົນ)`;

    if(bills.length === 0) {
        container.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500 font-medium">✨ ບໍ່ທັນມີຂໍ້ມູນໃບບິນຫວຍເທິງ Cloud. ກະລຸນາຄີຂໍ້ມູນດ້ານເທິງ!</div>`;
        return;
    }

    bills.forEach((bill) => {
        let netAmount = bill.totalAmount - bill.profit;
        const card = document.createElement('div');
        card.className = "bg-white rounded-xl shadow-lg p-4 border border-gray-200 flex flex-col justify-between relative overflow-hidden";
        
        let itemsHtml = bill.items.map(it => `
            <div class="flex justify-between items-center text-xs bg-slate-50 p-1.5 rounded border border-slate-100 font-mono">
                <span class="font-bold text-gray-800">${it.number}</span>
                <span class="text-[10px] px-1 bg-indigo-50 text-indigo-600 rounded">${it.type === '3 ຕົວ' ? '3T':'2T'}</span>
                <span class="text-gray-600">${(it.amount).toLocaleString()}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start border-b pb-2 mb-3">
                    <div>
                        <h4 class="font-bold text-base text-gray-900">👤 ${bill.customer}</h4>
                        <span class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">${roomNames[bill.room]}</span>
                    </div>
                    <span class="text-xs font-bold text-pink-600 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-md">ເປີເຊັນ: ${bill.pct}%</span>
                </div>
                <div class="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                    <div class="grid grid-cols-2 gap-1.5">${itemsHtml}</div>
                </div>
            </div>
            <div class="mt-4 border-t border-dashed pt-3 space-y-1.5 bg-slate-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                <div class="flex justify-between text-xs text-gray-500"><span>ຍອດລວມຊື້:</span><span class="font-bold text-gray-900">${bill.totalAmount.toLocaleString()}</span></div>
                <div class="flex justify-between text-xs text-green-600"><span>ຫັກເປີເຊັນ:</span><span class="font-bold">-${bill.profit.toLocaleString()}</span></div>
                <div class="flex justify-between text-sm font-bold text-indigo-700 border-t pt-1.5"><span>💵 ຍອດສົ່ງສຸດທິ:</span><span>${netAmount.toLocaleString()} ກີບ</span></div>
                <div class="grid grid-cols-3 gap-1 pt-3 border-t mt-2">
                    <button class="btn-copy bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-1 rounded transition" data-id="${bill.id}">📋 ກັອບປີ້</button>
                    <button class="btn-edit bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold py-1.5 px-1 rounded transition" data-id="${bill.id}">✏️ ແກ້ໄຂ</button>
                    <button class="btn-delete bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold py-1.5 px-1 rounded transition" data-id="${bill.id}">🗑️ ລຶບ</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // ຈັບ Event ໃຫ້ປຸ່ມຕ່າງໆໃນກາດບິນຫວຍ
    document.querySelectorAll('.btn-copy').forEach(b => b.addEventListener('click', (e) => copySingleBill(e.target.dataset.id)));
    document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', (e) => editBill(e.target.dataset.id)));
    document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', (e) => deleteBill(e.target.dataset.id)));
}

function calculateSummary() {
    let totalSalesAll = 0, totalProfitAll = 0;
    let roomSummary = { room1: { sales: 0, profit: 0 }, room2: { sales: 0, profit: 0 }, room3: { sales: 0, profit: 0 } };

    bills.forEach(bill => {
        totalSalesAll += bill.totalAmount; totalProfitAll += bill.profit;
        if (roomSummary[bill.room]) { roomSummary[bill.room].sales += bill.totalAmount; roomSummary[bill.room].profit += bill.profit; }
    });

    document.getElementById('totalSalesAll').innerText = totalSalesAll.toLocaleString() + " ກີບ";
    document.getElementById('totalProfitAll').innerText = totalProfitAll.toLocaleString() + " ກີບ";
    document.getElementById('totalNetAll').innerText = (totalSalesAll - totalProfitAll).toLocaleString() + " ກີບ";

    ['room1', 'room2', 'room3'].forEach(r => {
        document.getElementById(`${r}Sales`).innerText = roomSummary[r].sales.toLocaleString() + " ກີບ";
        document.getElementById(`${r}Profit`).innerText = roomSummary[r].profit.toLocaleString() + " ກີບ";
        document.getElementById(`${r}Net`).innerText = (roomSummary[r].sales - roomSummary[r].profit).toLocaleString() + " ກີບ";
    });
}

function editBill(id) {
    const bill = bills.find(b => b.id == id); if (!bill) return;
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
    document.getElementById('editingBillId').value = ""; document.getElementById('batchCustomer').value = ""; document.getElementById('batchText').value = "";
    document.getElementById('formTitle').innerText = "📝 ຄີຂໍ້ມູນຫວຍ";
    document.getElementById('btnSubmit').innerText = "⚡ ບັນທຶກລົງ Cloud Database";
    document.getElementById('btnCancelEdit').classList.add('hidden'); document.getElementById('editModeBadge').classList.add('hidden');
}

function searchWinners() {
    const winNum = document.getElementById('winningNumberInput').value.trim();
    const tbody = document.getElementById('winnerTableBody');
    if (!winNum) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 bg-amber-50/50">ກະລຸນາກອກເລກລາງວັນເພື່ອຄົ້ນຫາ</td></tr>`;
        document.getElementById('winnerCountLabel').innerText = "0 ລາຍການ"; document.getElementById('winnerTotalPayoutLabel').innerText = "0 ກີບ";
        currentWinnersList = []; return;
    }

    currentWinnersList = []; let totalPayout = 0;
    bills.forEach(bill => {
        bill.items.forEach(item => {
            if (item.number === winNum) {
                let rate = 0;
                if (bill.room === "room1") rate = item.type === "3 ຕົວ" ? 650 : 90;
                else if (bill.room === "room2") rate = item.type === "3 ຕົວ" ? 600 : 80;
                else if (bill.room === "room3") rate = item.type === "3 ຕົວ" ? 500 : 70;
                let payout = item.amount * rate; totalPayout += payout;
                currentWinnersList.push({ customer: bill.customer, number: item.number, type: item.type, room: bill.room, payoutAmount: payout });
            }
        });
    });

    tbody.innerHTML = '';
    if (currentWinnersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500 font-medium bg-white">❌ ງວດນີ້ບໍ່ມີໃຜຖືກເລກ ${winNum}</td></tr>`;
        document.getElementById('winnerCountLabel').innerText = "0 ລາຍການ"; document.getElementById('winnerTotalPayoutLabel').innerText = "0 ກີບ"; return;
    }

    currentWinnersList.forEach(w => {
        const tr = document.createElement('tr'); tr.className = "bg-white text-gray-700";
        tr.innerHTML = `<td class="p-2 font-bold">${w.customer}</td><td class="p-2 text-indigo-600 font-bold">${w.number}</td><td class="p-2"><span class="px-1.5 py-0.5 text-[10px] font-bold rounded ${w.type === '3 ຕົວ' ? 'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}">${w.type}</span></td><td class="p-2 text-xs">${roomNames[w.room]}</td><td class="p-2 font-bold text-red-600">+${w.payoutAmount.toLocaleString()}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('winnerCountLabel').innerText = `${currentWinnersList.length} ລາຍການ`;
    document.getElementById('winnerTotalPayoutLabel').innerText = totalPayout.toLocaleString() + " ກີບ";
}

function copySingleBill(id) {
    const bill = bills.find(b => b.id == id); if(!bill) return;
    let text = `🧾 ໃບບິນຫວຍສະຫຼຸບ | 👤 ລູກຄ້າ: ${bill.customer}\n📍 ຫ້ອງ: ${roomNames[bill.room]}\n-------------------------\n`;
    bill.items.forEach((item, i) => { text += `${i+1}. [${item.type}] ${item.number} = ${item.amount.toLocaleString()} ກີບ\n`; });
    text += `-------------------------\n💰 ຍອດລວມຊື້: ${bill.totalAmount.toLocaleString()} ກີບ\n✨ ເປີເຊັນຫັກໄດ້: -${bill.profit.toLocaleString()} ກີບ\n💵 ຍອດສຸດທິທີ່ຕ້ອງຈ່າຍ: ${(bill.totalAmount - bill.profit).toLocaleString()} ກີບ\n\n🙏 ຂອບໃຈຄຮັບ!`;
    navigator.clipboard.writeText(text).then(() => { alert(`📋 ຄັດລອກໃບບິນຂອງ [${bill.customer}] ແລ້ວ!`); });
}

function copyToClipboard() {
    if(bills.length === 0) { alert('ບໍ່ມີຂໍ້ມູນໃບບິນ'); return; }
    let textOutput = "📌 ຍອດສະຫຼຸບສົ່ງຫວຍ (Cloud Database ວາງໃນ WhatsApp)\n=========================\n";
    let grandTotalSales = 0, grandTotalNet = 0;
    bills.forEach((bill) => {
        let net = bill.totalAmount - bill.profit; grandTotalSales += bill.totalAmount; grandTotalNet += net;
        textOutput += `\n👤 ຜູ້ສົ່ງ: ${bill.customer} (${roomNames[bill.room]})\n-------------------------\n`;
        bill.items.forEach((item, i) => { textOutput += `   ${i+1}. ${item.number} = ${item.amount.toLocaleString()} ກີບ\n`; });
        textOutput += `   ➔ ຍອດລວມຊື້: ${bill.totalAmount.toLocaleString()} | ຫັກເປີເຊັນ: -${bill.profit.toLocaleString()} | ສຸດທິ: ${net.toLocaleString()} ກີບ\n`;
    });
    textOutput += `\n=========================\n💰 ຍອດຂາຍລວມ: ${grandTotalSales.toLocaleString()} ກີບ\n💵 ຍອດໂອນສົ່ງເຈົ້າມື: ${grandTotalNet.toLocaleString()} ກີບ`;
    navigator.clipboard.writeText(textOutput).then(() => { alert('📋 ຄັດລອກຂໍ້ຄວາມສະຫຼຸບທຸກຫ້ອງແລ້ວ!'); });
}

function copyWinnersToClipboard() {
    const winNum = document.getElementById('winningNumberInput').value.trim();
    if(!winNum || currentWinnersList.length === 0) { alert('ບໍ່ມີລາຍຊື່ຄົນຖືກເລກ'); return; }
    let textOutput = `🎉 ລາຍຊື່ຜູ້ຖືກເລກ [ ${winNum} ] \n-------------------------\n`;
    currentWinnersList.forEach((w, index) => { textOutput += `${index+1}. ລູກຄ້າ: ${w.customer} ➔ ເລກ: ${w.number}, ໄດ້ຮັບ: +${w.payoutAmount.toLocaleString()} ກີບ\n`; });
    let totalPayout = currentWinnersList.reduce((sum, t) => sum + t.payoutAmount, 0);
    textOutput += `-------------------------\n💵 ລວມຍອດເງິນລາງວັນ: ${totalPayout.toLocaleString()} ກີບ`;
    navigator.clipboard.writeText(textOutput).then(() => { alert('📋 ຄັດລອກລາຍຊື່ຄົນຖືກເລກແລ້ວ!'); });
}