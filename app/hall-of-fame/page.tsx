import type { Metadata } from "next";
import Link from "next/link";
import { HallOfFameBoard } from "@/components/hall-of-fame";

export const metadata: Metadata = { title: "Hall of Fame" };

export default function HallOfFamePage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          THE NAMES THAT NEVER FADE FROM THE SCREEN
        </p>
      </div>

      <HallOfFameBoard />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          BACK TO LIBRARY
        </Link>
      </div>
    </div>
  );
}
