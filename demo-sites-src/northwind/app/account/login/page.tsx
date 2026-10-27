import { Crumbs } from "@/components/chrome";
import { LoginForm } from "@/components/widgets";

export const metadata = { title: "Sign in", description: "Sign in to manage your Northwind bookings." };

export default function Login() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Sign in"]]} />
      <section><div className="wrap" style={{ maxWidth: 480 }}><h1>Sign in</h1><p className="lead">Manage your bookings and documents.</p><LoginForm /></div></section>
    </>
  );
}
