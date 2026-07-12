import loginScreenImage from "@assets/login-screen-image.png";

export function AuthHeroPanel() {
  return (
    <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-primary">
      <img
        src={loginScreenImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
