def get_hex_map():
    samples = "ￓￍ￁￑ﾑﾖﾒﾰﾺￖￋ￁ￂￃￄￅￇ￈￉ￊￌￎￏ￐ￒￕￗ￙ￚￛￜﾝ"
    for s in samples:
        print(f"'{s}' : {hex(ord(s))} ")

get_hex_map()
