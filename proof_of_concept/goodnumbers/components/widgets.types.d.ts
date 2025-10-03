type Widget = {
  id?: string;
  /** Does it have a background? */
  hasBackground?: boolean;
};

type BackgroundProps = {
  children?: React.ReactNode;
  hasBackground?: boolean;
};

type CallToActionType = {
  text?: string;
  href: string;
  icon?: Icon;
  targetBlank?: boolean;
};

type Image = {
  link?: string;
  src: string | StaticImageData;
  alt: string;
};

type CallToActionType = {
  text?: string;
  href: string;
  icon?: Icon;
  targetBlank?: boolean;
};

type LinkOrButton = {
  callToAction?: CallToActionType;
  containerClass?: string;
  linkClass?: string;
  iconClass?: string;
};

type HeroProps = {
  title?: string | ReactElement;
  subtitle?: string | ReactElement;
  tagline?: string;
  callToAction?: CallToActionType;
  callToAction2?: CallToActionType;
  image?: Image;
};

type AnnouncementProps = {
  title: string;
  callToAction?: CallToActionType;
  callToAction2?: CallToActionType;
};

type Icon = TablerIcon;

type Link = {
  label?: string;
  href?: string;
  ariaLabel?: string;
  icon?: Icon;
};

type MenuLink = Link & {
  links?: Array<Link>;
};

type Header = {
  title?: string;
  subtitle?: string;
  tagline?: string;
  position?: string;
};

type HeaderProps = {
  links?: Array<MenuLink>;
  actions?: Array<CallToActionType>;
  // actions?: Array<ActionLink>;
  isSticky?: boolean;
  showToggleTheme?: boolean;
  showRssFeed?: boolean;
  position?: 'center' | 'right' | 'left';
};

type FooterProps = {
  title?: string;
  links?: Array<Link>;
  columns: Array<Links>;
  socials: Array<Link>;
  footNote?: string | ReactElement;
  theme?: string;
};

type NightscoutWidgetProps = Widget & {
  header?: Header;
  content?: string;
  items?: Array<Item>;
  // form: FormProps;
};
