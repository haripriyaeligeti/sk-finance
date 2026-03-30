import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders chit finance heading", () => {
  render(<App />);
  const headingElement = screen.getByText(
    /manage chit groups, monthly collections/i,
  );
  expect(headingElement).toBeInTheDocument();
});
