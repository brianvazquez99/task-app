// Import the functions you need from the SDKs you need
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import {
	PUBLIC_apiKey,
	PUBLIC_authDomain,
	PUBLIC_projectId,
	PUBLIC_storageBucket,
	PUBLIC_messagingSenderId,
	PUBLIC_appId,
	PUBLIC_measurementId
} from '$env/static/public';
import { browser } from '$app/env';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: PUBLIC_apiKey,
	authDomain: PUBLIC_authDomain,
	projectId: PUBLIC_projectId,
	storageBucket: PUBLIC_storageBucket,
	messagingSenderId: PUBLIC_messagingSenderId,
	appId: PUBLIC_appId,
	measurementId: PUBLIC_measurementId
};

// Initialize Firebase
let fireBaseApp: FirebaseApp | undefined;
if (!getApps().length && browser) {
	fireBaseApp = initializeApp(firebaseConfig);
} else if (getApps().length && browser) {
	fireBaseApp = getApps()[0];
}
const db = browser ? getFirestore(fireBaseApp!) : null;
const analytics = getAnalytics(fireBaseApp);

export { fireBaseApp, db, analytics };
