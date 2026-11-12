module counter3(input clk, input rst, output reg [2:0] q);
  always @(posedge clk) if (rst) q <= 0; else q <= q + 2;
endmodule
