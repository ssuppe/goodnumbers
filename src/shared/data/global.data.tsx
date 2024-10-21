import {
  IconBrandFacebook,
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandTwitter,
  IconChevronDown,
  IconRss,
} from '@tabler/icons-react';
import { AnnouncementProps, FooterProps, HeaderProps } from '../types';

// Announcement data
export const announcementData: AnnouncementProps = {
  title: 'NOTE',
  callToAction: {
    text: 'GoodNumbers is an experiment and is for educational use only. Do not make any changes to your diabetic healthcare plan without speaking to your doctor.',
    href: 'https://nextjs.org/blog/next-14',
  },
  // callToAction2: {
  //   text: 'Follow @onWidget on Twitter',
  //   href: 'https://twitter.com/intent/user?screen_name=onwidget',
  // },
};

// Header data
export const headerData: HeaderProps = {
  links: [
    // {
    //   label: 'Pages',
    //   icon: IconChevronDown,
    //   links: [
    //     {
    //       label: 'Services',
    //       href: '/services',
    //     },
    //     {
    //       label: 'Pricing',
    //       href: '/pricing',
    //     },
        
    //   ],
    // },
    {
      label: 'About',
      href: '/about',
    },
    {
      label: 'Blog',
      href: '/blog',
    },
    {
      label: 'Contact',
      href: '/contact',
    },
  ],
  // actions: [
  //   {
  //     text: 'Try Now',
  //     href: '/trynow',
  //     targetBlank: false,
  //   },
  // ],
  isSticky: true,
  showToggleTheme: true,
  showRssFeed: false,
  position: 'right',
};

// Footer data
export const footerData: FooterProps = {
  title: 'GoodNumbers',
  links: [
    {
      label: 'Terms & Conditions',
      href: '/terms',
    },
    {
      label: 'Privacy Policy',
      href: '/privacy',
    },
  ],
  columns: [
    {
      title: 'Product',
      links: [
        {
          label: 'Features',
          href: '/',
        },
        {
          label: 'Security',
          href: '/',
        },
        {
          label: 'Team',
          href: '/',
        },
        {
          label: 'Enterprise',
          href: '/',
        },
        {
          label: 'Customer stories',
          href: '/',
        },
        {
          label: 'Pricing',
          href: '/pricing',
        },
        {
          label: 'Resources',
          href: '/',
        },
      ],
    },
    {
      title: 'Platform',
      links: [
        {
          label: 'Developer API',
          href: '/',
        },
        {
          label: 'Partners',
          href: '/',
        },
      ],
    },
    {
      title: 'Support',
      links: [
        {
          label: 'Docs',
          href: '/',
        },
        {
          label: 'Community Forum',
          href: '/',
        },
        {
          label: 'Professional Services',
          href: '/',
        },
        {
          label: 'Skills',
          href: '/',
        },
        {
          label: 'Status',
          href: '/',
        },
      ],
    },
    {
      title: 'Company',
      links: [
        {
          label: 'About',
          href: '/',
        },
        {
          label: 'Blog',
          href: '/blog',
        },
        {
          label: 'Careers',
          href: '/',
        },
        {
          label: 'Press',
          href: '/',
        },
        {
          label: 'Inclusion',
          href: '/',
        },
        {
          label: 'Social Impact',
          href: '/',
        },
        {
          label: 'Shop',
          href: '/',
        },
      ],
    },
  ],
  socials: [
    // { label: 'Twitter', icon: IconBrandTwitter, href: '#' },
    // { label: 'Instagram', icon: IconBrandInstagram, href: '#' },
    // { label: 'Facebook', icon: IconBrandFacebook, href: '#' },
    // { label: 'RSS', icon: IconRss, href: '#' },
    // { label: 'Github', icon: IconBrandGithub, href: 'https://github.com/onwidget/tailnext' },
  ],
  footNote: (
    <div className="mr-4 rtl:mr-0 rtl:ml-4 text-sm">
      <span className="float-left rtl:float-right mr-1.5 rtl:mr-0 rtl:ml-1.5 h-5 w-5 rounded-sm bg-[url(https://onwidget.com/favicon/favicon-32x32.png)] bg-cover md:-mt-0.5 md:h-6 md:w-6"></span>
      <span>
        
      </span>
    </div>
  ),
};

// Footer2 data
export const footerData2: FooterProps = {
  links: [
    {
      label: 'Terms & Conditions',
      href: '/terms',
    },
    {
      label: 'Privacy Policy',
      href: '/privacy',
    },
  ],
  columns: [
    // {
    //   title: 'Address',
    //   texts: ['', ''],
    // },
    // {
    //   title: 'Phone',
    //   texts: ['', ''],
    // },
    // {
    //   title: 'Email',
    //   texts: ['', ''],
    // },
  ],
  socials: [
    // { label: 'Twitter', icon: IconBrandTwitter, href: '#' },
    // { label: 'Instagram', icon: IconBrandInstagram, href: '#' },
    // { label: 'Facebook', icon: IconBrandFacebook, href: '#' },
    // { label: 'RSS', icon: IconRss, href: '#' },
    // { label: 'Github', icon: IconBrandGithub, href: 'https://github.com/onwidget/tailnext' },
  ],
  footNote: (
    <div className="mr-4 rtl:mr-0 rtl:ml-4 text-sm">
      <span className="float-left rtl:float-right mr-1.5 rtl:mr-0 rtl:ml-1.5 h-5 w-5 rounded-sm bg-[url(https://onwidget.com/favicon/favicon-32x32.png)] bg-cover md:-mt-0.5 md:h-6 md:w-6"></span>
      <span>
        Made by{' '}
        
        · All rights reserved.
      </span>
    </div>
  ),
};
