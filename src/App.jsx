import React, { useState, useEffect } from "react";
import {
	Heart,
	Stethoscope,
	Thermometer,
	Ruler,
	AlertCircle,
	RefreshCw,
	Clock,
} from "lucide-react";

// Firebase imports
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

// Firebase configuration - replace with your actual config
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MASSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENTI_D,
};

// Severity calculation function
const calculateSeverity = (pressure, temp) => {
	// Ensure we have valid numbers
	const validPressure = typeof pressure === "number" ? pressure : 0;
	const validTemp = typeof temp === "number" ? temp : 0;

	let severity = 0;

	// Pressure severity
	if (validPressure < 110) severity += 25;
	else if (validPressure < 120) severity += 50;
	else if (validPressure < 130) severity += 75;
	else severity += 100;

	// Temperature severity
	if (validTemp < 26 || validTemp > 34) severity += 25;
	else if (validTemp < 27 || validTemp > 33) severity += 15;
	else if (validTemp < 28 || validTemp > 32) severity += 10;

	return Math.min(severity, 100);
};

const SEVERITY_LEVELS = [
	{
		max: 20,
		color: "bg-green-500",
		text: "Low Risk",
		warningClass: "text-green-600",
	},
	{
		max: 50,
		color: "bg-yellow-500",
		text: "Moderate Risk",
		warningClass: "text-yellow-600",
	},
	{
		max: 80,
		color: "bg-orange-500",
		text: "High Risk",
		warningClass: "text-orange-600",
	},
	{
		max: 100,
		color: "bg-red-600",
		text: "Critical Risk",
		warningClass: "text-red-600",
	},
];

const getSeverityInfo = (severity) => {
	return (
		SEVERITY_LEVELS.find((level) => severity <= level.max) ||
		SEVERITY_LEVELS[SEVERITY_LEVELS.length - 1]
	);
};

const PatientMonitoringDashboard = () => {
	const [patientData, setPatientData] = useState(null);
	const [footHealth, setFootHealth] = useState(null);
	const [severity, setSeverity] = useState(0);
	const [error, setError] = useState(null);
	const [updateTimes, setUpdateTimes] = useState([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [database, setDatabase] = useState(null);
	const [availablePatients, setAvailablePatients] = useState([]);
	const [currentPatientKey, setCurrentPatientKey] = useState(null);

	// Initialize Firebase on component mount
	useEffect(() => {
		let app;
		try {
			app = initializeApp(firebaseConfig);
			const db = getDatabase(app);
			setDatabase(db);
		} catch (initError) {
			if (initError.code !== "app/duplicate-app") {
				setError("Failed to initialize Firebase");
			}
		}
	}, []);

	// Fetch data function
	const fetchData = () => {
		if (!database) return;

		setIsRefreshing(true);
		const parentRef = ref(database, "adddelete");

		onValue(
			parentRef,
			(snapshot) => {
				const data = snapshot.val();
				if (data) {
					const keys = Object.keys(data);
					const patientGroups = keys.filter(
						(key) =>
							data[key].patients && Object.keys(data[key].patients).length > 0
					);

					// If no patient groups found
					if (patientGroups.length === 0) {
						setError("No patient groups found");
						setIsRefreshing(false);
						return;
					}

					// Select a random patient group
					const randomGroupKey =
						patientGroups[Math.floor(Math.random() * patientGroups.length)];
					const patientsInGroup = Object.keys(data[randomGroupKey].patients);

					// Select a random patient from the group
					const randomPatientKey =
						patientsInGroup[Math.floor(Math.random() * patientsInGroup.length)];
					const patientPath = `${randomGroupKey}/patients/${randomPatientKey}`;
					const patientRef = ref(database, `adddelete/${patientPath}`);

					// Update available patients list
					setAvailablePatients(patientsInGroup);
					setCurrentPatientKey(randomPatientKey);

					onValue(
						patientRef,
						(patientSnapshot) => {
							const patientData = patientSnapshot.val();
							if (patientData) {
								setPatientData(patientData.info || null);
								const sensorData = patientData.sensorData?.footHealth;
								if (sensorData) {
									setFootHealth(sensorData);
									const newSeverity = calculateSeverity(
										sensorData.footPressure,
										sensorData.footTemp
									);
									setSeverity(newSeverity);

									// Add current timestamp to update times
									const currentTime = new Date().toLocaleString();
									setUpdateTimes((prev) => [currentTime, ...prev].slice(0, 5));
								} else {
									setFootHealth(null);
									setSeverity(0);
								}
							} else {
								setError("No patient data found");
							}
							setIsRefreshing(false);
						},
						(err) => {
							setError(`Firebase Error: ${err.message}`);
							setIsRefreshing(false);
						}
					);
				} else {
					setError("No patient data found");
					setIsRefreshing(false);
				}
			},
			(err) => {
				setError(`Firebase Error: ${err.message}`);
				setIsRefreshing(false);
			}
		);
	};

	// Auto-refresh interval
	useEffect(() => {
		if (!database) return;

		const intervalId = setInterval(fetchData, 5000);
		return () => clearInterval(intervalId);
	}, [database]);

	const severityInfo = getSeverityInfo(severity);

	const safeToFixed = (value, decimals = 1) =>
		typeof value === "number" ? value.toFixed(decimals) : "N/A";

	return (
		<div className="min-h-screen bg-gray-100 flex flex-col max-w-xlg">
			{/* Error Notification */}
			{error && (
				<div
					className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
					role="alert"
				>
					<AlertCircle className="inline-block mr-2" />
					<span className="block sm:inline">{error}</span>
				</div>
			)}

			{/* Hero Section */}
			<div className="bg-blue-600 text-white p-8 shadow-md">
				<div className="container mx-auto flex items-center justify-between">
					<div className="flex items-center">
						<Heart size={64} className="mr-4" />
						<div>
							<h1 className="text-3xl font-bold">
								Patient Monitoring Dashboard
							</h1>
							<p className="text-xl">Real-time Foot Health Tracking</p>
						</div>
					</div>
					<button
						onClick={fetchData}
						disabled={isRefreshing}
						className={`
							flex items-center px-4 py-2 rounded 
							${isRefreshing ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"}
							text-white transition-colors
						`}
					>
						<RefreshCw
							className={`mr-2 ${isRefreshing ? "animate-spin" : ""}`}
						/>
						Refresh
					</button>
				</div>
			</div>

			{/* Main Content */}
			<div className="container mx-auto mt-8 grid md:grid-cols-3 gap-6">
				{/* Patient Information */}
				<div className="bg-white shadow-md rounded-lg p-6 md:col-span-2">
					<h2 className="text-2xl font-semibold mb-4 flex items-center">
						<Stethoscope className="mr-2" /> Patient Information
					</h2>
					{patientData ? (
						<div className="space-y-3">
							<p>
								<strong>Name:</strong> {patientData.name || "N/A"}
							</p>
							<p>
								<strong>Age:</strong> {patientData.age || "N/A"}
							</p>
							<p>
								<strong>Gender:</strong> {patientData.gender || "N/A"}
							</p>
							<p>
								<strong>Condition:</strong> {patientData.condition || "N/A"}
							</p>
							<p>
								<strong>Last Checkup:</strong>{" "}
								{patientData.lastCheckup || "N/A"}
							</p>
							{currentPatientKey && (
								<p>
									<strong>Patient ID:</strong> {currentPatientKey}
								</p>
							)}
						</div>
					) : (
						<p className="text-gray-500">Loading patient information...</p>
					)}
				</div>

				{/* Update Times */}
				<div className="bg-white shadow-md rounded-lg p-6">
					<h2 className="text-2xl font-semibold mb-4 flex items-center">
						<Clock className="mr-2" /> Update History
					</h2>
					{updateTimes.length > 0 ? (
						<ul className="space-y-2">
							{updateTimes.map((time, index) => (
								<li
									key={index}
									className="flex items-center text-sm text-gray-600"
								>
									<Clock className="mr-2 w-4 h-4" />
									{time}
								</li>
							))}
						</ul>
					) : (
						<p className="text-gray-500">No updates yet</p>
					)}
				</div>

				{/* Foot Health Status */}
				<div className="bg-white shadow-md rounded-lg p-6 md:col-span-3">
					<h2 className="text-2xl font-semibold mb-4 flex items-center">
						<Thermometer className="mr-2" /> Foot Health Status
					</h2>
					{footHealth ? (
						<div className="space-y-4">
							{/* Warning Section */}
							{severity > 50 && (
								<div
									className={`
									p-4 rounded-lg 
									${severityInfo.warningClass} 
									bg-${severityInfo.color.split("-")[1]}-100
								`}
								>
									<AlertCircle className="inline-block mr-2" />
									<span className="font-semibold">
										{severityInfo.text} - Immediate Attention Required
									</span>
								</div>
							)}

							<div className="grid md:grid-cols-2 gap-4">
								<div className="flex items-center">
									<Ruler className="mr-2" />
									<span>
										Foot Pressure: {safeToFixed(footHealth.footPressure)}psi
									</span>
								</div>
								<div className="flex items-center">
									<Thermometer className="mr-2" />
									<span>
										Foot Temperature: {safeToFixed(footHealth.footTemp)}°C
									</span>
								</div>
							</div>

							<div className="mt-4">
								<div className="text-lg font-semibold mb-2">
									Severity Level:
								</div>
								<div
									className={`w-full h-6 rounded ${severityInfo.color}`}
									style={{ width: `${severity}%` }}
								>
									<div className="text-center text-white font-bold">
										{severity}%
									</div>
								</div>
								<p className="mt-2 text-sm text-gray-600">
									{severityInfo.text}
								</p>
							</div>
						</div>
					) : (
						<p className="text-gray-500">Waiting for sensor data...</p>
					)}
				</div>
			</div>
		</div>
	);
};

export default PatientMonitoringDashboard;

