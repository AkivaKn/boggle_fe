import { useEffect } from "react";
import type { OutOfLineRoute } from "../../router";
import HowToPlay from "./HowToPlay";
import Landing from "./Landing";
import Room from "./Room";
import "./outofline.css";

export default function OutOfLineApp({ route }: { route: OutOfLineRoute }) {
  useEffect(() => {
    const previous = document.title;
    document.title =
      route.screen === "howto"
        ? "How to play · Out of Line"
        : route.screen === "room"
          ? `Room ${route.code.toUpperCase()} · Out of Line`
          : "Out of Line";
    return () => {
      document.title = previous;
    };
  }, [route]);

  return (
    <div className="ool-theme">
      {route.screen === "home" ? <Landing /> : null}
      {route.screen === "howto" ? <HowToPlay /> : null}
      {route.screen === "room" ? (
        <Room key={route.code.toUpperCase()} code={route.code.toUpperCase()} />
      ) : null}
    </div>
  );
}
