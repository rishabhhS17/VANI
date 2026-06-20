import React from "react";

export const Loader = ({ color = "currentColor", size = 60 }: { color?: string; size?: number }) => {
  return (
    <>
      <div className="matrix-loader" style={{ width: size, height: size, '--loader-color': color } as React.CSSProperties} />
      <style>{`
        .matrix-loader {
          --_lineThickness: var(--line-thickness, 10%);
          background: linear-gradient(
              #0000 calc(1 * 160% / 6),
              var(--loader-color) 0 calc(3 * 115% / 6),
              #0000 0
            ),
            linear-gradient(
              #0000 calc(2 * 110% / 6),
              var(--loader-color) 0 calc(4 * 110% / 6),
              #0000 0
            ),
            linear-gradient(
              #0000 calc(3 * 100% / 6),
              var(--loader-color) 0 calc(5 * 107.6% / 6),
              #0000 0
            ),
            linear-gradient(#0000 calc(2 * 0% / 6), var(--loader-color) 0 calc(4 * 22% / 6), #0000 0);
          background-size: var(--_lineThickness) 400%;
          background-repeat: no-repeat;
          background-color: transparent;
          animation: matrix 1s infinite linear;
        }

        @keyframes matrix {
          0% {
            background-position: 0% 100%, 50% 100%, 100% 100%, 100% 100%;
          }
          100% {
            background-position: 0% 0%, 50% 0%, 100% 0%, 100% 0%;
          }
        }
      `}</style>
    </>
  );
};
