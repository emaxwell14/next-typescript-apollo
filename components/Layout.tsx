import Head from "next/head";
import Link from "next/link";
import * as React from "react";
import styled from "styled-components";
import { MeComponent } from "../generated/apolloComponents";

type Props = {
  title?: string;
};

const Container = styled.div`
  background-color: #fafafa;
`;

const Layout: React.FunctionComponent<Props> = ({
  children,
  title = "This is the default title"
}) => (
  <Container>
    <Head>
      <title>{title}</title>
      <meta charSet="utf-8" />
      <meta name="viewport" content="initial-scale=1.0, width=device-width" />
    </Head>
    <header>
      <nav>
        <Link href="/">
          <a>Home</a>
        </Link>{" "}
        |{" "}
        <Link href="/hello">
          <a>Hello</a>
        </Link>{" "}
        |{" "}
        <Link href="/register">
          <a>Register</a>
        </Link>{" "}
        |{" "}
        <Link href="/forgot-password">
          <a>Forgot Password</a>
        </Link>{" "}
        |{" "}
        <Link href="/login">
          <a>Login</a>
        </Link>{" "}
        <MeComponent>
          {({ data, loading }) => {
            if (loading || !data || !data.me) {
              return null;
            }
            return (
              <>
                |{" "}
                <Link href="/logout">
                  <a>Logout</a>
                </Link>
              </>
            );
          }}
        </MeComponent>
      </nav>
    </header>
    {children}
    <footer>
      <hr />
      <span>I'm here to stay (Footer)</span>
    </footer>
  </Container>
);

export default Layout;
