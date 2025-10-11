import type { User } from '@goodnumbers/types'; // Verify workspace linking

// This is just a dummy function to use the User type.
const getDummyUser = (): User | null => {
  console.log('User type is available');
  return null;
};

export default function HomePage() {
  getDummyUser();

  return (
    <div>
      <h1>Goodnumbers Home</h1>
    </div>
  );
}