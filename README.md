# AI Face Recognition Attendance System

A modern, real-time attendance management system powered by AI face recognition. This system allows administrators to register students, capture face data, and automatically mark attendance using a webcam.

## 🚀 Features

- **Admin Dashboard**: Real-time analytics and statistics.
- **Student Management**: Add, edit, and delete student records.
- **Face Registration**: Capture 15 images per student to generate high-accuracy face encodings.
- **Real-time Recognition**: Automated attendance marking using `face-api.js`.
- **Reporting**: Filter attendance by date and export records.
- **Modern UI**: Built with Tailwind CSS, featuring dark mode and glassmorphism.

## 🛠️ Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide React, Recharts, Motion.
- **Backend**: Node.js, Express, Better-SQLite3.
- **AI**: `face-api.js` (TensorFlow.js based).
- **Database**: SQLite.

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/face-attendance-ai.git
   cd face-attendance-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## 🔑 Admin Credentials

- **Username**: `admin`
- **Password**: `admin123`

## 📂 Project Structure

```
face-attendance-ai/
├── server.ts           # Express backend
├── database.db         # SQLite database
├── src/
│   ├── App.tsx         # Main frontend logic
│   ├── lib/
│   │   ├── faceApi.ts  # Face recognition utilities
│   │   └── gemini.ts   # Gemini AI integration
│   └── main.tsx
├── package.json
└── README.md
```

## 📝 License

This project is licensed under the Apache-2.0 License.
