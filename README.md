# 💪 Real-Time Exercise Rep Counter with Pose Estimation

A browser-based fitness application that performs real-time human pose estimation using **MediaPipe Tasks Vision JS** and counts exercise repetitions (bicep curls, squats, push-ups) with custom joint angle calculations and state machine logic.

**Live Demo:** [Add your Vercel/Netlify link here once deployed]  
**Video Demo:** [Add short YouTube/unlisted video or GIF here]

https://github.com/Siddhesh-Bhatkar/fitness-pose-rep-counter/assets/xxxxxxxxx/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  <!-- optional: embed GIF/video -->

## Features
- Real-time pose detection with **33 body landmarks** using MediaPipe Pose Landmarker (lite model)
- Accurate rep counting for multiple exercises via smoothed angle-based state machine
- Live overlay: REPS count, current STAGE (up/down), joint ANGLE in degrees
- Supports webcam feed or uploaded video for testing
- Responsive dark-themed UI built with React + Vite + TypeScript
- Optimized for smooth performance (30+ FPS on standard laptops)

## Demo Screenshots
(Add screenshots here after pushing – or upload them to repo and link)

![App Screenshot 1](screenshots/app1.png)
![App Screenshot 2](screenshots/app2.png)

## Tech Stack
- **Frontend:** React 19, Vite, TypeScript
- **Computer Vision:** MediaPipe Tasks Vision JS (Pose Landmarker lite)
- **Build Tool:** Vite
- **Styling:** CSS (dark theme with canvas overlay)
- **Others:** npm, canvas for landmark drawing

## Installation & Run Locally

```bash
# Clone the repo
git clone https://github.com/Siddhesh-Bhatkar/fitness-pose-rep-counter.git

# Go to project folder
cd fitness-pose-rep-counter

# Install dependencies
npm install

# Start development server
npm run dev
