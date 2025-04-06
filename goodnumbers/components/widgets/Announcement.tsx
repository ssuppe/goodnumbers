/* eslint-disable @next/next/no-img-element */

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

const Announcement = () => {
  const { title, callToAction, callToAction2 } = announcementData;

  return (
    <div className="hidden overflow-hidden text-ellipsis whitespace-nowrap border-b border-red-900 bg-red-900 px-3 py-2 text-sm text-gray-200 md:block">
      <span className="bg-blue-800 py-0.5 px-1 text-xs font-semibold">{title}</span>{' '}
      {callToAction && callToAction.text && callToAction.href && (
        <span>
          {callToAction.icon && <callToAction.icon className="mr-1 -ml-1.5 h-5 w-5" />} {callToAction.text}
        </span>
      )}
      {callToAction2 && callToAction2.text && callToAction2.href && (
        <a
          href={callToAction2.href}
          target="_blank"
          rel="noreferrer noopened"
          className="float-right rtl:float-left"
          title={callToAction2.text}
        >
          <img
            src="https://img.shields.io/twitter/url/https/twitter.com/onwidget.svg?style=social&amp;label=Follow%20%40onWidget"
            alt="Follow @onWidget"
            width="125"
            height="20"
          />
        </a>
      )}
    </div>
  );
};

export default Announcement;
