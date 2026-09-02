export function DataError({ message }: { message: string }) {
  return (
    <div className="data-error" role="alert">
      <strong>Archive connection unavailable</strong>
      <p>{message}</p>
    </div>
  );
}
