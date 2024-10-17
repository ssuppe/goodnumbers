import { IconClock, IconHeadset, IconHelp, IconMapPin, IconMessages, IconPhoneCall } from '@tabler/icons-react';
import { FeaturesProps, NightscoutProps } from '~/shared/types';


// Contact data on Contact page *******************
export const nightscout: NightscoutProps = {
  id: 'nightscout-trynow',
  hasBackground: true,
  header: {
    title: 'Try Now with Nightscout',
    subtitle: (
      <>
        Are you using <a href="https://nightscout.github.io/" target="_blank">Nightscout</a>?{' '}
        <span className="hidden md:inline">{`Enter your details and we can generate a podcast for you based on your last 7 days of data.`}</span>
      </>
    ),
  },
  // items: [
  //   {
  //     title: 'Our Address',
  //     description: ['1230 Maecenas Street Donec Road', 'New York, EEUU'],
  //     icon: IconMapPin,
  //   },
  //   {
  //     title: 'Contact',
  //     description: ['Mobile: +1 (123) 456-7890', 'Mail: tailnext@gmail.com'],
  //     icon: IconPhoneCall,
  //   },
  //   {
  //     title: 'Working hours',
  //     description: ['Monday - Friday: 08:00 - 17:00', 'Saturday & Sunday: 08:00 - 12:00'],
  //     icon: IconClock,
  //   },
  // ],
  form: {
    isLoading: false,
    onSubmit: function () {
      return undefined;
    },
    title: 'Enter your Nightscout details here',
    inputs: [
      {
        type: 'text',
        label: 'Nightscout URL',
        name: 'nightscout_url',
        autocomplete: 'off',
        placeholder: 'http://www.example.com',
      },
      {
        type: 'text',
        label: 'Nightscout token',
        name: 'nightscout_token',
        autocomplete: 'off',
        placeholder: 'Enter your token here',
      },
    ],
    // radioBtns: {
    //   label: 'What do you want to generate?',
    //   radios: [
    //     {
    //       label: 'Text only',
    //     },
    //     // {
    //     //   label: 'Technical help',
    //     // },
    //     // {
    //     //   label: 'Claims',
    //     // },
    //     // {
    //     //   label: 'Others',
    //     // },
    //   ],
    // },
    // textarea: {
    //   cols: 30,
    //   rows: 5,
    //   label: 'How can we help you?',
    //   name: 'textarea',
    //   placeholder: 'Write your message...',
    // },
    checkboxes: [
      {
        label: 'Do you understand this is an experiment and for education purposes only?',
        value: '',
      },
      // {
      //   label: 'Do you want to receive monthly updates by email?',
      //   value: '',
      // },
    ],
    btn: {
      title: 'Create',
      type: 'submit',
    },
  },
};


