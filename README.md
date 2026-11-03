## <a name="introduction">✨ Introduction</a>

This application is a full-featured React Native language-learning platform that leverages a sophisticated AI teacher for real-time voice interaction. Rather than just another "toy" demo, it serves as a masterclass in Practical Vibe Coding, a structured workflow using tools like Expo, Clerk, and Stream to build production-ready apps without writing manual code. It transforms the "app you never built" into a shipped reality by bridging the gap between raw AI prompting and professional software architecture.


## <a name="tech-stack">⚙️ Tech Stack</a>

- **[React Native](https://reactnative.dev/)** is an open-source framework for building native mobile applications using React. It allows developers to use a single codebase for both iOS and Android by rendering with native UI components for high performance.

- **[Expo](https://expo.dev/)** is an open-source platform and framework for universal React applications. It provides a set of tools and services that simplify the development, building, and deployment process, allowing for rapid iteration and seamless access to native device APIs.

- **[TypeScript](https://www.typescriptlang.org/)** is a strongly typed programming language that builds on JavaScript, providing static types to catch errors early and improving the developer experience with robust autocompletion and refactoring tools.

- **[NativeWind](https://www.nativewind.dev/)** uses Tailwind CSS as a scripting engine to create a universal styling system for React Native. It allows you to style mobile components using familiar utility classes, ensuring consistent design and rapid UI development.

- **[Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)** is a small, fast, and scalable state-management solution. It provides a simple API based on hooks, making it easy to manage global application state without the boilerplate or complexity of other libraries.

- **[Clerk](https://jsm.dev/lingua-clerk)** is a complete user management and authentication solution. It offers pre-built components for sign-in, sign-up, and user profiles, along with secure social login integration and multi-factor authentication out of the box.

- **[Stream](https://jsm.dev/lingua-stream)** provides real-time audio infrastructure for AI-driven voice interactions. It enables the app to hear, see, and act in real-time, powering the conversational AI teacher with low-latency communication.

- **[PostHog](https://jsm.dev/lingua-posthog)** is an all-in-one product analytics platform. It helps developers understand user behavior, track key events within the app, and utilize session recordings to improve product-market fit and user engagement.

- **[CodeRabbit](https://jsm.dev/lingua-coderabbit)** is an AI-powered code review platform that integrates into your CI/CD pipeline. It automatically reviews pull requests to identify bugs and suggest improvements, acting as a persistent reviewer for every AI-generated code change.

## <a name="features">🔋 Features</a>

👉 **Onboarding Flow**: A seamless mobile sequence for language selection and goal setting, proving the gap between "I want to build this" and "it's running on my phone" is now just a weekend.

👉 **Auth Pages**: Secure and professional signup and sign-in functionality utilizing email and social auth, powered by **Clerk** for robust user management.

👉 **Real-Time AI Teacher**: An immersive "speak and respond" experience powered by **Stream Voice Agents**, allowing for natural, back-and-forth verbal practice that feels like having a tutor always around.

👉 **Lesson Interface**: A core learning engine built with **React Native**, **Expo**, and **TypeScript**, using **NativeWind** to maintain a polished UI that survives contact with serious features.

👉 **State Management**: Clean and scalable app logic handled by **Zustand**, ensuring your "Practical Vibe Coding" workflow stays structured without getting lost in spaghetti code.

👉 **Analytics & Review**: Production-ready monitoring via **PostHog**, paired with **CodeRabbit** to automatically review every AI-generated PR before it ever merges into your codebase.

And many more, including code architecture and reusability.

## <a name="quick-start">🤸 Quick Start</a>

Follow these steps to set up the project locally on your machine.

**Prerequisites**

Make sure you have the following installed on your machine:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en)
- [npm](https://www.npmjs.com/) (Node Package Manager)

## Installation

Before you begin developing your app, it's essential to set up Expo and initialize your project.

- Start by creating a folder for your application. Then, open your terminal and navigate to that folder. To create an Expo app, you can use:

```bash
npx create-expo-app@latest
```

By default, you get a TypeScript Expo app with Expo Router configured.

If you want a different starter (blank JS, blank TS, tabs, etc.), you can run:

```bash
npx create-expo-app@latest --template
```

And pick whichever template fits your workflow.

Since this repository is already created, install dependencies and start the development server:

```bash
npm install
npx expo start
```

`npx expo start` means "download (if needed) and execute Expo locally." It starts Metro Bundler, which compiles and serves your React Native code.

Once it starts, you'll see a QR code and shortcut keys in the terminal. For example:

- `a` opens Android
- `i` opens iOS Simulator (macOS)
- `w` opens web
- `r` reloads
- `m` opens dev menu in Expo Go / device context

We don't need to rely on heavy IDE tooling to begin. The easiest flow is using Expo Go on your phone.

Expo Go is a mobile app that lets you test React Native apps quickly by scanning a QR code. It's fast, beginner-friendly, and supports real-time updates while you code.

Open Google Play Store or Apple App Store, install **Expo Go**, then come back here and scan the QR code.

### iOS VPN Turn OFF, and network permissions…

Now open Expo Go and scan the QR code from the terminal. The app should compile and launch.

If all is good, you'll see the starter app with two tabs: Home and Explore.

**Set Up Environment Variables**

Create a new file named `.env` in the root of your project and add the following content:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=

POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=

STREAM_API_KEY=
STREAM_API_SECRET=

# Vision Agent
# Run `uv run main.py serve` inside vision-agent/
VISION_AGENT_URL=http://localhost:8000

# OpenAI API key (required for the vision-agent)
OPENAI_API_KEY=
```


**Running the Project**

```bash
npx expo start
```
