module acc(input clk, input rst, input [1:0] d, input go, output [2:0] q, output z);
  reg [2:0] r;
  always @(posedge clk) if (rst) r <= 3'd0; else if (go) r <= {r[1:0] ^ d, r[2] & d[0]};
  assign q = r;
  assign z = (^r) | go;
endmodule
