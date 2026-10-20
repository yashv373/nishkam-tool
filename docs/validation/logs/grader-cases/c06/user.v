module counter(input clk, input rst, input en, output reg [3:0] q);
  always @(posedge clk) if (rst) q <= 0; else if (en) q <= q + 2;
endmodule
