import type { ReactNode, AnchorHTMLAttributes, ReactElement } from 'react';
import type { RouteProps } from './common.js';
declare global {
    interface ImportMeta {
        readonly env: Record<string, string>;
    }
}
type ChangeLocation = (path?: string, searchParams?: URLSearchParams, hash?: string, method?: 'pushState' | 'replaceState' | false, scrollTo?: ScrollToOptions | false) => void;
type PrefetchLocation = (path: string, searchParams: URLSearchParams) => void;
export declare function useChangeLocation(): ChangeLocation;
export declare function usePrefetchLocation(): PrefetchLocation;
export declare function useLocation(): RouteProps;
export type LinkProps = {
    to: string;
    pending?: ReactNode;
    notPending?: ReactNode;
    children: ReactNode;
    unstable_prefetchOnEnter?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;
export declare function Link({ to, children, pending, notPending, unstable_prefetchOnEnter, ...props }: LinkProps): ReactElement;
export declare function Router({ children }: {
    children?: ReactElement;
}): import("react").FunctionComponentElement<{
    children: ReactElement<any, string | import("react").JSXElementConstructor<any>>;
}>;
export {};
//# sourceMappingURL=client.native.d.ts.map