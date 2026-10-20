module gray_cnt(input clk, input rst, input en, output [3:0] g);
  reg [3:0] b;
  always @(posedge clk) if (rst) b <= 0; else if (en) b <= b + 1;
  assign g = b ^ (b << 1);
endmodule
