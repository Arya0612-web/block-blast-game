import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyChnw_aL8GsdBLjIRddfSCmFiZvMGjbeFE",
  authDomain: "block-blast-61f83.firebaseapp.com",
  projectId: "block-blast-61f83",
  storageBucket: "block-blast-61f83.firebasestorage.app",
  messagingSenderId: "1049217738449",
  appId: "1:1049217738449:web:c4c0e3b22f3d44d8d5c7f0",
  measurementId: "G-LJ9E98P5LD"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);