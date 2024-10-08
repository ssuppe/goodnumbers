import type { Metadata } from 'next';

import Nightscout from '~/components/widgets/Nightscout';
import { nightscout } from '~/shared/data/pages/trynow.data';

export const metadata: Metadata = {
  title: 'Try Now',
};

const Page = () => {
  return (
    <>
      <Nightscout {...nightscout} />
    </>
  );
};

export default Page;
