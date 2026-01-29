/**
 * TypeScript declarations for react-facebook-pixel
 * @see https://www.npmjs.com/package/react-facebook-pixel
 */

declare module 'react-facebook-pixel' {
  export interface AdvancedMatchingOptions {
    em?: string; // email
    fn?: string; // first name
    ln?: string; // last name
    ph?: string; // phone
    ge?: string; // gender
    db?: string; // date of birth
    ct?: string; // city
    st?: string; // state
    zp?: string; // zip
    country?: string;
    external_id?: string;
  }

  export interface InitOptions {
    autoConfig?: boolean;
    debug?: boolean;
  }

  export interface StandardEventData {
    content_name?: string;
    content_category?: string;
    content_ids?: string[];
    content_type?: string;
    contents?: Array<{ id: string; quantity: number }>;
    currency?: string;
    value?: number;
    num_items?: number;
    search_string?: string;
    status?: boolean;
    [key: string]: any;
  }

  type StandardEvent =
    | 'PageView'
    | 'Lead'
    | 'CompleteRegistration'
    | 'AddPaymentInfo'
    | 'AddToCart'
    | 'AddToWishlist'
    | 'InitiateCheckout'
    | 'Purchase'
    | 'Search'
    | 'ViewContent'
    | 'Contact'
    | 'CustomizeProduct'
    | 'Donate'
    | 'FindLocation'
    | 'Schedule'
    | 'StartTrial'
    | 'SubmitApplication'
    | 'Subscribe';

  const ReactPixel: {
    init: (
      pixelId: string,
      advancedMatching?: AdvancedMatchingOptions,
      options?: InitOptions
    ) => void;
    pageView: () => void;
    track: (title: StandardEvent, data?: StandardEventData) => void;
    trackSingle: (
      pixelId: string,
      title: StandardEvent,
      data?: StandardEventData
    ) => void;
    trackCustom: (event: string, data?: Record<string, any>) => void;
    trackSingleCustom: (
      pixelId: string,
      event: string,
      data?: Record<string, any>
    ) => void;
    fbq: (...args: any[]) => void;
  };

  export default ReactPixel;
}
