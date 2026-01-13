"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./components/MapView"), { ssr: false });

export default function Home() {
  return (
    <main style={{ padding: 20 }}>
      <h1>Brewery Map</h1>
      <MapView />
    </main>
  );
}