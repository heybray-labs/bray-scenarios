export function AuthHeroPanel({ imageSrc }: { imageSrc: string }) {
  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-primary">
      <img
        src={imageSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
