module traffic(input clk, input rst, output g, output y, output r);
  reg [1:0] s;
  always @(posedge clk)
    if (rst) s <= 0;
    else case (s)
      2'd0: s <= 2'd1;
      2'd1: s <= 2'd2;
      default: s <= 2'd0;
    endcase
  assign g = (s == 2'd0);
  assign y = (s == 2'd1);
  assign r = (s == 2'd2);
endmodule
