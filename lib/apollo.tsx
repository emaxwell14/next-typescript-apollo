import { ApolloProvider } from "@apollo/react-hooks";
import { InMemoryCache } from "apollo-cache-inmemory";
import { ApolloClient } from "apollo-client";
import { setContext } from "apollo-link-context";
import { onError } from "apollo-link-error";
import { HttpLink } from "apollo-link-http";
import cookie from "cookie";
import fetch from "isomorphic-unfetch";
import Head from "next/head";
import Router from "next/router";
import PropTypes from "prop-types";
import React from "react";
import redirect from "./redirect";

interface Options {
  getToken: () => string;
}

interface WithApollo {
  apolloClient: ApolloClient<InMemoryCache>;
  apolloState: any;
}

/**
 * Creates and provides the apolloContext
 * to a next.js PageTree. Use it by wrapping
 * your PageComponent via HOC pattern.
 * @param {Function|Class} PageComponent
 * @param {Object} [config]
 * @param {Boolean} [config.ssr=true]
 */
export function withApollo(PageComponent: any, { ssr = true } = {}) {
  const WithApollo = ({
    apolloClient,
    apolloState,
    ...pageProps
  }: WithApollo) => {
    const client = apolloClient || initApolloClient(apolloState, { getToken });
    return (
      <ApolloProvider client={client}>
        <PageComponent {...pageProps} />
      </ApolloProvider>
    );
  };

  if (process.env.NODE_ENV !== "production") {
    // Find correct display name
    const displayName =
      PageComponent.displayName || PageComponent.name || "Component";

    // Warn if old way of installing apollo is used
    if (displayName === "App") {
      console.warn("This withApollo HOC only works with PageComponents.");
    }

    // Set correct display name for devtools
    WithApollo.displayName = `withApollo(${displayName})`;

    // Add some prop types
    WithApollo.propTypes = {
      // Used for getDataFromTree rendering
      apolloClient: PropTypes.object,
      // Used for client/server rendering
      apolloState: PropTypes.object
    };
  }

  if (ssr || PageComponent.getInitialProps) {
    WithApollo.getInitialProps = async (ctx: any) => {
      const { AppTree } = ctx;

      // Run all GraphQL queries in the component tree
      // and extract the resulting data
      const apolloClient = (ctx.apolloClient = initApolloClient(
        {},
        {
          getToken: () => getToken(ctx.req)
        }
      ));

      const pageProps = PageComponent.getInitialProps
        ? await PageComponent.getInitialProps(ctx)
        : {};

      // Only on the server
      if (typeof window === "undefined") {
        // When redirecting, the response is finished.
        // No point in continuing to render
        if (ctx.res && ctx.res.finished) {
          return {};
        }

        if (ssr) {
          try {
            // Run all GraphQL queries
            const { getDataFromTree } = await import("@apollo/react-ssr");
            await getDataFromTree(
              <AppTree
                pageProps={{
                  ...pageProps,
                  apolloClient
                }}
              />
            );
          } catch (error) {
            // Prevent Apollo Client GraphQL errors from crashing SSR.
            // Handle them in components via the data.error prop:
            // https://www.apollographql.com/docs/react/api/react-apollo.html#graphql-query-data-error
            console.error("Error while running `getDataFromTree`", error);
            if (error.message.includes("not authenticated")) {
              redirect(ctx, "/login");
            }
          }
        }

        // getDataFromTree does not call componentWillUnmount
        // head side effect therefore need to be cleared manually
        Head.rewind();
      }

      // Extract query data from the Apollo store
      const apolloState = apolloClient.cache.extract();

      return {
        ...pageProps,
        apolloState
      };
    };
  }

  return WithApollo;
}

let apolloClient: ApolloClient<InMemoryCache> | null = null;

/**
 * Always creates a new apollo client on the server
 * Creates or reuses apollo client in the browser.
 */
function initApolloClient(...args: any[]) {
  // Make sure to create a new client for every server-side request so that data
  // isn't shared between connections (which would be bad)
  if (typeof window === "undefined") {
    // @ts-ignore
    return createApolloClient(...args);
  }

  // Reuse client on the client-side
  if (!apolloClient) {
    // @ts-ignore
    apolloClient = createApolloClient(...args);
  }

  return apolloClient;
}

/**
 * Creates and configures the ApolloClient
 * @param  {Object} [initialState={}]
 * @param  {Object} config
 */
function createApolloClient(initialState: any = {}, { getToken }: Options) {
  const fetchOptions: { agent?: any } = {};

  // If you are using a https_proxy, add fetchOptions with 'https-proxy-agent' agent instance
  // 'https-proxy-agent' is required here because it's a sever-side only module
  if (typeof window === "undefined") {
    if (process.env.https_proxy) {
      fetchOptions.agent = new (require("https-proxy-agent"))(
        process.env.https_proxy
      );
    }
  }

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
      graphQLErrors.forEach(({ message, locations, path }) => {
        console.log(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
        // Only on client
        if (
          typeof window !== "undefined" &&
          message.includes("not authenticated")
        ) {
          Router.replace("/login");
        }
      });
    if (networkError) console.log(`[Network error]: ${networkError}`);
  });

  const httpLink = new HttpLink({
    uri: "http://localhost:4000/graphql",
    credentials: "include",
    fetch,
    fetchOptions
  });

  const authLink = setContext((_, { headers }) => {
    const token = getToken();
    return {
      headers: {
        ...headers,
        // authorization: token ? `Bearer ${token}` : '',
        cookie: token ? `qid=${token}` : ""
      }
    };
  });

  // Check out https://github.com/zeit/next.js/pull/4611 if you want to use the AWSAppSyncClient
  return new ApolloClient({
    ssrMode: typeof window === "undefined", // Disables forceFetch on the server (so queries are only run once)
    link: errorLink.concat(authLink.concat(httpLink)),
    cache: new InMemoryCache().restore(initialState)
  });
}

/**
 * Get the user token from cookie
 * @param {Object} req
 */
function getToken(req?: any) {
  const cookies = cookie.parse(
    req ? req.headers.cookie || "" : document.cookie
  );
  // return cookies.token
  return cookies.qid;
}
