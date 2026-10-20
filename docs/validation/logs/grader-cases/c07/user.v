module counter(input clk, input rst, input en, output reg [3:0] q);
  always @(posedge clk) if (rst) q <= 1; else if (en) q <= q + 1;
endmodule
