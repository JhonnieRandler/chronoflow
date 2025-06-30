// Cole aqui a configuração do seu projeto Firebase.
// Você pode encontrá-la no Console do Firebase > Configurações do Projeto.
// ESTE ARQUIVO AGORA USA A SINTAXE MODULAR MODERNA DO FIREBASE (v9+).
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCzmuoUFqz9mbCOG5zT0oaTPi-i15LYm_E",
  authDomain: "chronoflow-e4a11.firebaseapp.com",
  projectId: "chronoflow-e4a11",
  storageBucket: "chronoflow-e4a11.firebasestorage.app",
  messagingSenderId: "406625730884",
  appId: "1:406625730884:web:faad94ac63af1255459711",
};

let db;
let initializationError = null;

// Verifique se a configuração foi preenchida.
if (
  firebaseConfig.apiKey === "YOUR_API_KEY" ||
  firebaseConfig.projectId === "YOUR_PROJECT_ID"
) {
  initializationError = new Error(
    "Configuração do Firebase não preenchida. Por favor, edite o arquivo firebase-config.js."
  );
}

if (!initializationError) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    initializationError = e;
    console.error("Erro ao inicializar o Firebase:", e);
  }
}

function showFirebaseError() {
  document.body.innerHTML = `<div style="padding: 2rem; text-align: center; font-family: sans-serif; background-color: #fff3f3; color: #b91c1c; border: 1px solid #fecaca; margin: 2rem; border-radius: 0.5rem;">
        <h1>Erro de Configuração do Firebase</h1>
        <p>Não foi possível conectar ao banco de dados. Verifique se você configurou corretamente o arquivo <strong>firebase-config.js</strong> com as credenciais do seu projeto no Firebase.</p>
        <p>A página precisa ser recarregada após corrigir a configuração.</p>
        <p>Abra o console do desenvolvedor (F12) para mais detalhes técnicos sobre o erro.</p>
    </div>`;
}

export { db, initializationError, showFirebaseError };
