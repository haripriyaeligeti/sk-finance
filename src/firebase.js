import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNMK8F2aY9utdzf7XYqNbg6GRscNWDEnY",
  authDomain: "saikrishna-finance.firebaseapp.com",
  projectId: "saikrishna-finance",
  storageBucket: "saikrishna-finance.firebasestorage.app",
  messagingSenderId: "724216655364",
  appId: "1:724216655364:web:3598cde513cbd17cdbcf51",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
