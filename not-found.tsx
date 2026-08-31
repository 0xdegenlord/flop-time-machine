import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <p className="eyebrow">404 / frequency not found</p>
      <h1>Nothing is transmitting here.</h1>
      <Link className="primary-action" href="/">Return to the recorder</Link>
    </div>
  );
}
